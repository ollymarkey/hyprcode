export interface HarnessAdapterCapabilities {
  canRunPrompt: boolean;
  canContinueSession: boolean;
  canStartServer: boolean;
  canAttachToServer: boolean;
  canListAgents: boolean;
  canListModels: boolean;
  canStreamEvents: boolean;
  canExportSessions: boolean;
}

export interface HarnessAgentInfo {
  id: string;
  name: string;
  description?: string;
}

export interface HarnessModelInfo {
  id: string;
  provider?: string;
  name?: string;
}

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface HarnessServerTarget {
  url: string;
}

export interface HarnessServerHandle {
  target: HarnessServerTarget;
  stop(): Promise<void>;
}

export interface HarnessSessionSummary {
  id: string;
  title?: string;
}

export interface HarnessRunRequest {
  prompt: string;
  cwd?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  agent?: string;
  sessionId?: string;
  continueLastSession?: boolean;
  files?: string[];
}

export interface HarnessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  sessionId?: string;
}

export type HarnessStreamEvent =
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

export interface HarnessAdapter {
  name: string;
  capabilities: HarnessAdapterCapabilities;
  run?(request: HarnessRunRequest): Promise<HarnessRunResult>;
  stream?(request: HarnessRunRequest): AsyncIterable<HarnessStreamEvent>;
  startServer?(): Promise<HarnessServerHandle>;
  attach?(target: HarnessServerTarget): Promise<void>;
  listAgents?(): Promise<HarnessAgentInfo[]>;
  listModels?(provider?: string): Promise<HarnessModelInfo[]>;
}
