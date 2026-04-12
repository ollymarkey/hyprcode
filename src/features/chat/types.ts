export type ChatMessageRole = "assistant" | "user";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  serializedEditorState?: string;
};

export type ChatWindowState = {
  windowId: string;
  title: string;
  repoId: string;
  messages: ChatMessage[];
  draftPlainText: string;
  draftEditorState?: string;
};

export type ChatState = Record<string, ChatWindowState>;
