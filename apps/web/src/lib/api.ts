import type { ThreadSummary, WorkspaceBootstrapPayload, WorkspaceLayoutSnapshot } from "@hyprcode/contracts";

export interface HyprcodeApi {
  bootstrap(): Promise<WorkspaceBootstrapPayload>;
  createPane(): Promise<{ id: string }>;
  deletePane(paneId: string): Promise<WorkspaceLayoutSnapshot>;
  focusPane(paneId: string): Promise<WorkspaceLayoutSnapshot>;
  saveLayout(layout: WorkspaceLayoutSnapshot): Promise<WorkspaceLayoutSnapshot>;
  createThread(projectId: string, title?: string): Promise<ThreadSummary>;
  sendMessage(threadId: string, content: string): Promise<ThreadSummary>;
  resumeThread(threadId: string): Promise<ThreadSummary>;
  closeThread(threadId: string): Promise<ThreadSummary>;
  openTerminal(paneId: string): Promise<unknown>;
  closeTerminal(paneId: string): Promise<unknown>;
  codexStatus(): Promise<{ running: boolean; pid: number | null; lastError: string | null }>;
  connect(onEvent: (event: unknown) => void): WebSocket;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function createApi(serverUrl: string): HyprcodeApi {
  const baseUrl = serverUrl.replace(/\/$/, "");

  return {
    bootstrap: () => request(`${baseUrl}/api/bootstrap`),
    createPane: () => request(`${baseUrl}/api/panes`, { method: "POST" }),
    deletePane: (paneId) => request(`${baseUrl}/api/panes/${paneId}`, { method: "DELETE" }),
    focusPane: (paneId) => request(`${baseUrl}/api/panes/${paneId}/focus`, { method: "POST" }),
    saveLayout: (layout) => request(`${baseUrl}/api/layout`, { method: "PUT", body: JSON.stringify(layout) }),
    createThread: (projectId, title) =>
      request(`${baseUrl}/api/threads`, {
        method: "POST",
        body: JSON.stringify({ projectId, title }),
      }),
    sendMessage: (threadId, content) =>
      request(`${baseUrl}/api/threads/${threadId}/message`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    resumeThread: (threadId) => request(`${baseUrl}/api/threads/${threadId}/resume`, { method: "POST" }),
    closeThread: (threadId) => request(`${baseUrl}/api/threads/${threadId}/close`, { method: "POST" }),
    openTerminal: (paneId) => request(`${baseUrl}/api/panes/${paneId}/terminal/open`, { method: "POST" }),
    closeTerminal: (paneId) => request(`${baseUrl}/api/panes/${paneId}/terminal/close`, { method: "POST" }),
    codexStatus: () => request(`${baseUrl}/api/runtime/codex`),
    connect: (onEvent) => {
      const socket = new WebSocket(baseUrl.replace(/^http/, "ws") + "/ws");
      socket.addEventListener("message", (event) => {
        onEvent(JSON.parse(String(event.data)));
      });
      return socket;
    },
  };
}
