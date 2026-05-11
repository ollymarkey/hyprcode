export type ChatMessageRole = "assistant" | "user";

export type AgentProvider = "codex" | "opencode";

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type ChatRuntimeSettings = {
  harness: AgentProvider;
  model?: string;
  reasoningEffort: ReasoningEffort;
  harnessSessionId?: string;
};

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  serializedEditorState?: string;
  isStreaming?: boolean;
};

export type ChatWindowState = {
  windowId: string;
  title: string;
  repoId: string;
  settings: ChatRuntimeSettings;
  messages: ChatMessage[];
  draftPlainText: string;
  draftEditorState?: string;
};

export type ChatState = Record<string, ChatWindowState>;
