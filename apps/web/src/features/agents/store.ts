import { Store } from "@tanstack/react-store";
import { chatCommands } from "#/features/chat/store";
import { getAgentBridge } from "./transport";
import type {
  AgentState,
  AgentWindowState,
  CreateAgentSessionInput,
  NormalizedAgentEvent,
} from "./types";

function createWindowState(windowId: string): AgentWindowState {
  return {
    windowId,
    status: "idle",
    events: [],
    previews: {},
    approvals: {},
  };
}

export const agentStore = new Store<AgentState>({
  sessions: {},
  windows: {},
});

function applyAgentEvent(event: NormalizedAgentEvent) {
  agentStore.setState((state) => {
    const session = state.sessions[event.sessionId];
    const windowId = event.type === "session_created" ? event.session.windowId : session?.windowId;

    if (!windowId) {
      return state;
    }

    const currentWindow = state.windows[windowId] ?? createWindowState(windowId);
    const nextWindow: AgentWindowState = {
      ...currentWindow,
      sessionId: event.sessionId,
      events: [...currentWindow.events, event].slice(-80),
    };
    const nextSessions = { ...state.sessions };

    if (event.type === "session_created") {
      nextSessions[event.sessionId] = event.session;
      nextWindow.status = event.session.status;
    }

    if (event.type === "status") {
      nextWindow.status = event.status;
      if (nextSessions[event.sessionId]) {
        nextSessions[event.sessionId] = {
          ...nextSessions[event.sessionId],
          status: event.status,
          activeTool: event.activeTool,
          updatedAt: event.createdAt,
        };
      }
    }

    if (event.type === "assistant_delta") {
      chatCommands.appendAssistantDelta(windowId, event.messageId, event.delta);
      nextWindow.pendingAssistantMessageId = event.messageId;
    }

    if (event.type === "preview") {
      nextWindow.previews = {
        ...nextWindow.previews,
        [event.previewId]: event.payload,
      };
      nextWindow.activePreviewId = event.previewId;
    }

    if (event.type === "approval_requested") {
      nextWindow.status = "awaiting_approval";
      nextWindow.approvals = {
        ...nextWindow.approvals,
        [event.approval.id]: event.approval,
      };
    }

    if (event.type === "approval_resolved") {
      const approval = nextWindow.approvals[event.approvalId];

      if (approval?.status === "pending") {
        nextWindow.approvals = {
          ...nextWindow.approvals,
          [event.approvalId]: {
            ...approval,
            status: event.decision,
            resolvedAt: event.createdAt,
          },
        };
      }
    }

    if (event.type === "error") {
      nextWindow.status = "error";
      nextWindow.error = event.message;
    }

    return {
      sessions: nextSessions,
      windows: {
        ...state.windows,
        [windowId]: nextWindow,
      },
    };
  });
}

async function ensureSession(input: CreateAgentSessionInput) {
  const existingSessionId = agentStore.state.windows[input.windowId]?.sessionId;

  if (existingSessionId) {
    return existingSessionId;
  }

  const createdEvent = await getAgentBridge().createSession(input);
  applyAgentEvent(createdEvent);
  return createdEvent.sessionId;
}

export const agentCommands = {
  applyEvent: applyAgentEvent,

  async sendPrompt(windowId: string, title: string, repoId: string, prompt: string) {
    const sessionId = await ensureSession({
      windowId,
      repoId,
      cwd: "apps/web",
    });
    const assistantMessageId = chatCommands.createPendingAssistantMessage(windowId, title, repoId);

    const bridge = getAgentBridge();

    await bridge.sendPrompt(
      {
        sessionId,
        windowId,
        prompt,
        assistantMessageId,
      },
      applyAgentEvent,
    );
  },

  async abortWindow(windowId: string) {
    const sessionId = agentStore.state.windows[windowId]?.sessionId;

    if (!sessionId) {
      return;
    }

    applyAgentEvent(await getAgentBridge().abort(sessionId));
  },

  async resolveApproval(windowId: string, approvalId: string, decision: "approved" | "denied") {
    const sessionId = agentStore.state.windows[windowId]?.sessionId;

    if (!sessionId) {
      return false;
    }

    const approval = agentStore.state.windows[windowId]?.approvals[approvalId];

    if (approval?.status !== "pending") {
      return false;
    }

    applyAgentEvent(await getAgentBridge().resolveApproval({ sessionId, approvalId, decision }));
    return true;
  },

  reset() {
    agentStore.setState(() => ({ sessions: {}, windows: {} }));
  },
};
