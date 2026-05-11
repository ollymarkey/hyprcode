import type { HarnessStreamEvent } from "harness-sdk";

export type AgentProvider = "codex" | "opencode";

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type ClientMessage =
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

export type ServerMessage =
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
