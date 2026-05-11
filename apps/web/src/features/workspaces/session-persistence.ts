import type { ChatMessage, ChatRuntimeSettings } from "#/features/chat/types";
import type { WorkspaceState } from "./types";

export type WorkspaceSessionSnapshot = {
  version: 1;
  workspaceState: WorkspaceState;
  chatSettingsByWindowId: Record<string, ChatRuntimeSettings>;
};

export type PersistedChatSession = {
  id: string;
  windowId: string;
  title: string;
  repoId: string;
  createdAt: string;
  updatedAt: string;
};

export type HarnessAgentInfo = {
  id: string;
  name: string;
  capabilities?: Record<string, boolean>;
  isDefault?: boolean;
};

let snapshotProvider: (() => WorkspaceSessionSnapshot) | undefined;
let persistTimer: number | undefined;

function getHttpBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_HYPRCODE_HTTP_URL as string | undefined;

  if (configuredUrl) {
    return configuredUrl;
  }

  return `${window.location.protocol}//${window.location.hostname}:4317`;
}

export function configureWorkspaceSessionPersistence(provider: () => WorkspaceSessionSnapshot) {
  snapshotProvider = provider;
}

export function scheduleWorkspaceSessionPersist() {
  if (!snapshotProvider || typeof window === "undefined") {
    return;
  }

  if (persistTimer) {
    window.clearTimeout(persistTimer);
  }

  persistTimer = window.setTimeout(() => {
    persistTimer = undefined;
    void persistLatestWorkspaceSession(snapshotProvider?.()).catch((error) => {
      console.warn(error);
    });
  }, 350);
}

export async function loadLatestWorkspaceSession(): Promise<WorkspaceSessionSnapshot | null> {
  const response = await fetch(`${getHttpBaseUrl()}/workspace-session/latest`);

  if (!response.ok) {
    throw new Error(`Unable to load workspace session: ${response.status}`);
  }

  const body = (await response.json()) as {
    session?: { payload?: unknown } | null;
  };

  return isWorkspaceSessionSnapshot(body.session?.payload) ? body.session.payload : null;
}

export async function persistLatestWorkspaceSession(snapshot?: WorkspaceSessionSnapshot) {
  if (!snapshot) {
    return;
  }

  const response = await fetch(`${getHttpBaseUrl()}/workspace-session/latest`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ payload: snapshot }),
  });

  if (!response.ok) {
    throw new Error(`Unable to persist workspace session: ${response.status}`);
  }
}

export async function loadAgents(): Promise<HarnessAgentInfo[]> {
  const response = await fetch(`${getHttpBaseUrl()}/agents`);

  if (!response.ok) {
    throw new Error(`Unable to load agents: ${response.status}`);
  }

  const body = (await response.json()) as { agents?: HarnessAgentInfo[] };
  return body.agents ?? [];
}

export async function loadChatMessagesByWindowId(
  windowIds: string[],
): Promise<Record<string, ChatMessage[]>> {
  if (windowIds.length === 0) {
    return {};
  }

  const response = await fetch(`${getHttpBaseUrl()}/sessions`);

  if (!response.ok) {
    throw new Error(`Unable to load chat sessions: ${response.status}`);
  }

  const body = (await response.json()) as { sessions?: PersistedChatSession[] };
  const requestedWindowIds = new Set(windowIds);
  const sessions = (body.sessions ?? []).filter((session) =>
    requestedWindowIds.has(session.windowId),
  );
  const messagesByWindowId: Record<string, ChatMessage[]> = {};

  await Promise.all(
    sessions.map(async (session) => {
      const messagesResponse = await fetch(`${getHttpBaseUrl()}/sessions/${session.id}/messages`);

      if (!messagesResponse.ok) {
        return;
      }

      const messagesBody = (await messagesResponse.json()) as { messages?: ChatMessage[] };
      messagesByWindowId[session.windowId] = messagesBody.messages ?? [];
    }),
  );

  return messagesByWindowId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkspaceSessionSnapshot(value: unknown): value is WorkspaceSessionSnapshot {
  if (!isRecord(value) || value.version !== 1) {
    return false;
  }

  return isRecord(value.workspaceState) && isRecord(value.chatSettingsByWindowId);
}
