import type {
  CreateAgentSessionInput,
  NormalizedAgentEvent,
  ResolveAgentApprovalInput,
  SendAgentPromptInput,
} from "./types";

export type AgentBridge = {
  createSession(input: CreateAgentSessionInput): Promise<NormalizedAgentEvent>;
  sendPrompt(
    input: SendAgentPromptInput,
    emit: (event: NormalizedAgentEvent) => void,
  ): Promise<void>;
  abort(sessionId: string): Promise<NormalizedAgentEvent>;
  resolveApproval(input: ResolveAgentApprovalInput): Promise<NormalizedAgentEvent>;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createEventId() {
  return globalThis.crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export const mockAgentBridge: AgentBridge = {
  async createSession(input) {
    const createdAt = now();
    const sessionId = `agent-${input.windowId}`;

    return {
      id: createEventId(),
      sessionId,
      type: "session_created",
      createdAt,
      session: {
        id: sessionId,
        windowId: input.windowId,
        repoId: input.repoId,
        cwd: input.cwd,
        status: "idle",
        modelLabel: "Pi mock",
        createdAt,
        updatedAt: createdAt,
      },
    };
  },

  async sendPrompt(input, emit) {
    emit({
      id: createEventId(),
      sessionId: input.sessionId,
      type: "status",
      status: "running",
      label: "Thinking through the requested source change",
      activeTool: "hyprcode_show_widget",
      createdAt: now(),
    });

    const chunks = [
      "I have a Pi session connected to this chat window. ",
      "For now this is the mock bridge proving streamed assistant text, typed previews, and gated approvals. ",
      "The real Pi adapter can replace this transport without changing the chat surface.",
    ];

    for (const delta of chunks) {
      await delay(120);
      emit({
        id: createEventId(),
        sessionId: input.sessionId,
        type: "assistant_delta",
        messageId: input.assistantMessageId,
        delta,
        createdAt: now(),
      });
    }

    const previewId = createEventId();
    emit({
      id: createEventId(),
      sessionId: input.sessionId,
      type: "preview",
      previewId,
      payload: {
        kind: "diff",
        title: "Mock source edit preview",
        files: ["apps/web/src/features/chat/components/chat-window.tsx"],
        diff: `--- a/apps/web/src/features/chat/components/chat-window.tsx\n+++ b/apps/web/src/features/chat/components/chat-window.tsx\n@@\n- Send\n+ Send with Pi`,
      },
      createdAt: now(),
    });

    const approvalId = createEventId();
    emit({
      id: createEventId(),
      sessionId: input.sessionId,
      type: "approval_requested",
      approval: {
        id: approvalId,
        sessionId: input.sessionId,
        title: "Apply mock source edit",
        description:
          "Demonstrates the approval gate Pi will use before mutating frontend source files.",
        risk: "medium",
        status: "pending",
        createdAt: now(),
        payload: {
          kind: "diff",
          title: "Pending edit",
          files: ["apps/web/src/features/chat/components/chat-window.tsx"],
          diff: "Mock diff only. No files will be changed by the mock bridge.",
        },
      },
      createdAt: now(),
    });

    emit({
      id: createEventId(),
      sessionId: input.sessionId,
      type: "status",
      status: "awaiting_approval",
      label: "Waiting for approval",
      createdAt: now(),
    });
  },

  async abort(sessionId) {
    return {
      id: createEventId(),
      sessionId,
      type: "status",
      status: "aborted",
      label: "Run aborted",
      createdAt: now(),
    };
  },

  async resolveApproval(input) {
    return {
      id: createEventId(),
      sessionId: input.sessionId,
      type: "approval_resolved",
      approvalId: input.approvalId,
      decision: input.decision,
      createdAt: now(),
    };
  },
};
