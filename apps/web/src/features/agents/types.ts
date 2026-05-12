export type AgentRunStatus =
  | "idle"
  | "connecting"
  | "running"
  | "awaiting_approval"
  | "complete"
  | "error"
  | "aborted";

export type AgentPreviewPayload =
  | {
      kind: "diff";
      title: string;
      files: string[];
      diff: string;
    }
  | {
      kind: "command_output";
      title: string;
      command: string;
      output: string;
    }
  | {
      kind: "file";
      title: string;
      path: string;
      content: string;
    }
  | {
      kind: "status";
      title: string;
      detail: string;
    };

export type AgentApprovalRequest = {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  risk: "low" | "medium" | "high";
  payload: AgentPreviewPayload;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  resolvedAt?: string;
};

export type AgentSessionMetadata = {
  id: string;
  windowId: string;
  repoId: string;
  cwd: string;
  status: AgentRunStatus;
  modelLabel: string;
  createdAt: string;
  updatedAt: string;
  activeTool?: string;
  activePreviewId?: string;
};

export type NormalizedAgentEvent =
  | {
      id: string;
      sessionId: string;
      type: "session_created";
      session: AgentSessionMetadata;
      createdAt: string;
    }
  | {
      id: string;
      sessionId: string;
      type: "status";
      status: AgentRunStatus;
      label: string;
      activeTool?: string;
      createdAt: string;
    }
  | {
      id: string;
      sessionId: string;
      type: "assistant_delta";
      messageId: string;
      delta: string;
      createdAt: string;
    }
  | {
      id: string;
      sessionId: string;
      type: "preview";
      previewId: string;
      payload: AgentPreviewPayload;
      createdAt: string;
    }
  | {
      id: string;
      sessionId: string;
      type: "approval_requested";
      approval: AgentApprovalRequest;
      createdAt: string;
    }
  | {
      id: string;
      sessionId: string;
      type: "approval_resolved";
      approvalId: string;
      decision: "approved" | "denied";
      createdAt: string;
    }
  | {
      id: string;
      sessionId: string;
      type: "error";
      message: string;
      createdAt: string;
    };

export type AgentWindowState = {
  windowId: string;
  sessionId?: string;
  status: AgentRunStatus;
  events: NormalizedAgentEvent[];
  previews: Record<string, AgentPreviewPayload>;
  approvals: Record<string, AgentApprovalRequest>;
  pendingAssistantMessageId?: string;
  activePreviewId?: string;
  error?: string;
};

export type AgentState = {
  sessions: Record<string, AgentSessionMetadata>;
  windows: Record<string, AgentWindowState>;
};

export type CreateAgentSessionInput = {
  windowId: string;
  repoId: string;
  cwd: string;
};

export type SendAgentPromptInput = {
  sessionId: string;
  windowId: string;
  prompt: string;
  assistantMessageId: string;
};

export type ResolveAgentApprovalInput = {
  sessionId: string;
  approvalId: string;
  decision: "approved" | "denied";
};
