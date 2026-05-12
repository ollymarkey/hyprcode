import type { AgentRunStatus, NormalizedAgentEvent } from "./types";

function eventId() {
  return globalThis.crypto.randomUUID();
}

function createdAt() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function normalizePiEvent(sessionId: string, rawEvent: unknown): NormalizedAgentEvent {
  const event = rawEvent as {
    type?: string;
    messageId?: string;
    delta?: string;
    tool?: string;
    error?: string;
    message?: { id?: string; errorMessage?: string };
    assistantMessageEvent?: { type?: string; delta?: string; error?: { errorMessage?: string } };
    toolName?: string;
  };

  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent?.type === "text_delta") {
        return {
          id: eventId(),
          sessionId,
          type: "assistant_delta",
          messageId: readString(event.messageId ?? event.message?.id, `assistant-${sessionId}`),
          delta: readString(event.assistantMessageEvent.delta),
          createdAt: createdAt(),
        };
      }

      return {
        id: eventId(),
        sessionId,
        type: "assistant_delta",
        messageId: readString(event.messageId ?? event.message?.id, `assistant-${sessionId}`),
        delta: readString(event.delta),
        createdAt: createdAt(),
      };
    case "tool_start":
    case "tool_execution_start":
      return {
        id: eventId(),
        sessionId,
        type: "status",
        status: "running",
        label: `Running ${readString(event.tool ?? event.toolName, "tool")}`,
        activeTool:
          typeof event.tool === "string"
            ? event.tool
            : typeof event.toolName === "string"
              ? event.toolName
              : undefined,
        createdAt: createdAt(),
      };
    case "tool_execution_update":
      return {
        id: eventId(),
        sessionId,
        type: "status",
        status: "running",
        label: `Updating ${readString(event.toolName, "tool")}`,
        activeTool: typeof event.toolName === "string" ? event.toolName : undefined,
        createdAt: createdAt(),
      };
    case "tool_execution_end":
      return {
        id: eventId(),
        sessionId,
        type: "status",
        status: "running",
        label: `Finished ${readString(event.toolName, "tool")}`,
        activeTool: typeof event.toolName === "string" ? event.toolName : undefined,
        createdAt: createdAt(),
      };
    case "queue_update":
      return {
        id: eventId(),
        sessionId,
        type: "status",
        status: "running",
        label: "Queued agent work updated",
        createdAt: createdAt(),
      };
    case "completion":
    case "agent_end":
      return {
        id: eventId(),
        sessionId,
        type: "status",
        status: "complete",
        label: "Pi run complete",
        createdAt: createdAt(),
      };
    case "error":
      return {
        id: eventId(),
        sessionId,
        type: "error",
        message: readString(
          event.error ??
            event.message?.errorMessage ??
            event.assistantMessageEvent?.error?.errorMessage,
          "Pi reported an error",
        ),
        createdAt: createdAt(),
      };
    default: {
      const status: AgentRunStatus = "running";
      return {
        id: eventId(),
        sessionId,
        type: "status",
        status,
        label: readString(event.type, "Pi event received"),
        createdAt: createdAt(),
      };
    }
  }
}
