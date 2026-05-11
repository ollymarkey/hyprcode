import type { AgentProvider, ReasoningEffort } from "./types";

type HarnessStreamEvent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "message";
      role: string;
      content: string;
    }
  | {
      type: "tool-call";
      name: string;
      input?: unknown;
    }
  | {
      type: "status";
      status: string;
    }
  | {
      type: "raw";
      event: unknown;
    };

type ClientMessage =
  | {
      type: "run";
      clientRunId: string;
      windowId: string;
      title: string;
      repoId: string;
      prompt: string;
      cwd?: string;
      model?: string;
      reasoningEffort?: ReasoningEffort;
      agent?: AgentProvider;
      sessionId?: string;
    }
  | {
      type: "ping";
    };

type ServerMessage =
  | {
      type: "connected";
      serverTime: string;
    }
  | {
      type: "pong";
      serverTime: string;
    }
  | {
      type: "run-started";
      clientRunId: string;
      runId: string;
      sessionId: string;
      assistantMessageId: string;
    }
  | {
      type: "stream-event";
      clientRunId: string;
      runId: string;
      sessionId: string;
      assistantMessageId: string;
      event: HarnessStreamEvent;
    }
  | {
      type: "run-completed";
      clientRunId: string;
      runId: string;
      sessionId: string;
      assistantMessageId: string;
    }
  | {
      type: "run-failed";
      clientRunId?: string;
      runId?: string;
      sessionId?: string;
      assistantMessageId?: string;
      message: string;
    };

type StreamHandlers = {
  onRunStarted(message: Extract<ServerMessage, { type: "run-started" }>): void;
  onStreamEvent(message: Extract<ServerMessage, { type: "stream-event" }>): void;
  onRunCompleted(message: Extract<ServerMessage, { type: "run-completed" }>): void;
  onRunFailed(message: Extract<ServerMessage, { type: "run-failed" }>): void;
};

type RunPromptInput = {
  windowId: string;
  title: string;
  repoId: string;
  prompt: string;
  cwd?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  agent?: AgentProvider;
  sessionId?: string;
};

const windowHandlers = new Map<string, StreamHandlers>();
let socket: WebSocket | undefined;
let pendingMessages: ClientMessage[] = [];

function getWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_HYPRCODE_WS_URL as string | undefined;

  if (configuredUrl) {
    return configuredUrl;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:4317/ws`;
}

function getSocket(): WebSocket {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    return socket;
  }

  socket = new WebSocket(getWebSocketUrl());

  socket.addEventListener("open", () => {
    const messages = pendingMessages;
    pendingMessages = [];

    for (const message of messages) {
      socket?.send(JSON.stringify(message));
    }
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string) as ServerMessage;

    if (message.type === "connected" || message.type === "pong") {
      return;
    }

    if (!("clientRunId" in message) || !message.clientRunId) {
      return;
    }

    const windowId = message.clientRunId.split(":")[0];
    const handlers = windowHandlers.get(windowId);

    if (!handlers) {
      return;
    }

    switch (message.type) {
      case "run-started":
        handlers.onRunStarted(message);
        return;
      case "stream-event":
        handlers.onStreamEvent(message);
        return;
      case "run-completed":
        handlers.onRunCompleted(message);
        return;
      case "run-failed":
        handlers.onRunFailed(message);
        return;
      default:
        return;
    }
  });

  socket.addEventListener("close", () => {
    socket = undefined;
  });

  return socket;
}

function sendMessage(message: ClientMessage) {
  const currentSocket = getSocket();

  if (currentSocket.readyState === WebSocket.OPEN) {
    currentSocket.send(JSON.stringify(message));
    return;
  }

  pendingMessages.push(message);
}

export function subscribeToAgentStream(windowId: string, handlers: StreamHandlers) {
  windowHandlers.set(windowId, handlers);
  getSocket();

  return () => {
    windowHandlers.delete(windowId);
  };
}

export function runAgentPrompt(input: RunPromptInput) {
  const clientRunId = `${input.windowId}:${crypto.randomUUID()}`;

  sendMessage({
    type: "run",
    clientRunId,
    windowId: input.windowId,
    title: input.title,
    repoId: input.repoId,
    prompt: input.prompt,
    cwd: input.cwd,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    agent: input.agent,
    sessionId: input.sessionId,
  });
}
