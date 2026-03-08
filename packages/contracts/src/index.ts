export const runtimeSessionStates = [
  "connecting",
  "active",
  "waiting_approval",
  "waiting_input",
  "idle",
  "error",
  "closed",
] as const;

export type RuntimeSessionState = (typeof runtimeSessionStates)[number];

export interface ProjectSummary {
  id: string;
  name: string;
  cwd: string;
  branch: string | null;
  worktree: string | null;
  summary: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ThreadSummary {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  lastActivityAt: string;
  model: string;
  sessionState: RuntimeSessionState;
  branch: string | null;
  worktree: string | null;
  messages: ChatMessage[];
}

export interface WorkspacePane {
  id: string;
  order: number;
  threadId: string | null;
  projectId: string | null;
  focused: boolean;
  terminalOpen: boolean;
  collapsed: boolean;
  scrollTop: number;
}

export interface WorkspaceLayoutSnapshot {
  version: 1;
  columns: 2;
  focusedPaneId: string | null;
  panes: WorkspacePane[];
  updatedAt: string;
}

export type ServerEvent =
  | {
      type: "workspace.layout.updated";
      layout: WorkspaceLayoutSnapshot;
    }
  | {
      type: "thread.updated";
      thread: ThreadSummary;
    }
  | {
      type: "thread.removed";
      threadId: string;
    }
  | {
      type: "terminal.updated";
      paneId: string;
      open: boolean;
    }
  | {
      type: "approval.requested";
      threadId: string;
      requestId: string;
      message: string;
    }
  | {
      type: "user_input.requested";
      threadId: string;
      requestId: string;
      prompt: string;
    }
  | {
      type: "plan.proposed";
      threadId: string;
      markdown: string;
    };

export interface DesktopRuntimeInfo {
  serverUrl: string;
  platform: string;
}

export interface TerminalSessionSummary {
  paneId: string;
  terminalId: string;
  open: boolean;
}

export interface WorkspaceBootstrapPayload {
  projects: ProjectSummary[];
  threads: ThreadSummary[];
  layout: WorkspaceLayoutSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateRuntimeSessionState(value: unknown): value is RuntimeSessionState {
  return typeof value === "string" && runtimeSessionStates.includes(value as RuntimeSessionState);
}

export function validateProjectSummary(value: unknown): value is ProjectSummary {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.cwd) &&
    isNullableString(value.branch) &&
    isNullableString(value.worktree) &&
    isString(value.summary) &&
    isString(value.color)
  );
}

export function validateChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    (value.role === "user" || value.role === "assistant" || value.role === "system") &&
    isString(value.content) &&
    isString(value.createdAt)
  );
}

export function validateThreadSummary(value: unknown): value is ThreadSummary {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.projectId) &&
    isString(value.title) &&
    isString(value.summary) &&
    isString(value.lastActivityAt) &&
    isString(value.model) &&
    validateRuntimeSessionState(value.sessionState) &&
    isNullableString(value.branch) &&
    isNullableString(value.worktree) &&
    Array.isArray(value.messages) &&
    value.messages.every(validateChatMessage)
  );
}

export function validateWorkspacePane(value: unknown): value is WorkspacePane {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isNumber(value.order) &&
    isNullableString(value.threadId) &&
    isNullableString(value.projectId) &&
    isBoolean(value.focused) &&
    isBoolean(value.terminalOpen) &&
    isBoolean(value.collapsed) &&
    isNumber(value.scrollTop)
  );
}

export function validateWorkspaceLayoutSnapshot(value: unknown): value is WorkspaceLayoutSnapshot {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    value.columns === 2 &&
    isNullableString(value.focusedPaneId) &&
    Array.isArray(value.panes) &&
    value.panes.every(validateWorkspacePane) &&
    isString(value.updatedAt)
  );
}

export function validateWorkspaceBootstrapPayload(value: unknown): value is WorkspaceBootstrapPayload {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.projects) &&
    value.projects.every(validateProjectSummary) &&
    Array.isArray(value.threads) &&
    value.threads.every(validateThreadSummary) &&
    validateWorkspaceLayoutSnapshot(value.layout)
  );
}
