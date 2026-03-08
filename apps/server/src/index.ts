import path from "node:path";

import type { ServerEvent } from "@hyprcode/contracts";

import { WorkspaceService } from "./services/workspaceService";
import { JsonWorkspaceStore } from "./storage/jsonWorkspaceStore";
import { CodexProcessManager } from "./services/codexProcessManager";

const rootDir = path.resolve(process.cwd(), "../..");
const port = Number.parseInt(process.env.HYPRCODE_SERVER_PORT ?? "4318", 10);
const store = new JsonWorkspaceStore(rootDir, process.env.HYPRCODE_STATE_DIR);
const sockets = new Set<ServerWebSocket>();

function broadcast(event: ServerEvent) {
  const message = JSON.stringify(event);
  for (const socket of sockets) {
    socket.send(message);
  }
}

const workspace = new WorkspaceService(store, new CodexProcessManager(), broadcast);

type ServerWebSocket = Bun.ServerWebSocket<undefined>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  return {};
}

function getThreadId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[2] ?? null;
}

function getPaneId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[2] ?? null;
}

const server = Bun.serve({
  port,
  async fetch(request, serverRef) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (serverRef.upgrade(request)) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, port, statePath: store.path });
    }

    if (url.pathname === "/api/bootstrap") {
      return json(await workspace.bootstrap());
    }

    if (url.pathname === "/api/projects") {
      return json(await workspace.listProjects());
    }

    if (url.pathname === "/api/threads") {
      if (request.method === "GET") {
        return json(await workspace.listThreads());
      }
      if (request.method === "POST") {
        const body = (await parseBody(request)) as { projectId?: string; title?: string };
        const projects = await workspace.listProjects();
        const thread = await workspace.createThread(body.projectId ?? projects[0]!.id, body.title);
        return json(thread, 201);
      }
    }

    if (url.pathname === "/api/layout") {
      if (request.method === "GET") {
        return json((await workspace.bootstrap()).layout);
      }
      if (request.method === "PUT") {
        const body = await parseBody(request);
        return json(await workspace.saveLayout(body as any));
      }
    }

    if (url.pathname === "/api/panes" && request.method === "POST") {
      return json(await workspace.createPane(), 201);
    }

    if (url.pathname.startsWith("/api/panes/") && request.method === "DELETE") {
      const paneId = getPaneId(url);
      if (!paneId) return json({ error: "Missing pane id" }, 400);
      return json(await workspace.removePane(paneId));
    }

    if (url.pathname.startsWith("/api/panes/") && url.pathname.endsWith("/focus") && request.method === "POST") {
      const paneId = getPaneId(url);
      if (!paneId) return json({ error: "Missing pane id" }, 400);
      return json(await workspace.focusPane(paneId));
    }

    if (url.pathname.startsWith("/api/panes/") && url.pathname.endsWith("/terminal/open") && request.method === "POST") {
      const paneId = getPaneId(url);
      if (!paneId) return json({ error: "Missing pane id" }, 400);
      return json(await workspace.openTerminal(paneId), 201);
    }

    if (url.pathname.startsWith("/api/panes/") && url.pathname.endsWith("/terminal/write") && request.method === "POST") {
      const paneId = getPaneId(url);
      if (!paneId) return json({ error: "Missing pane id" }, 400);
      const body = (await parseBody(request)) as { data?: string };
      return json(await workspace.writeTerminal(paneId, body.data ?? ""));
    }

    if (url.pathname.startsWith("/api/panes/") && url.pathname.endsWith("/terminal/resize") && request.method === "POST") {
      const paneId = getPaneId(url);
      if (!paneId) return json({ error: "Missing pane id" }, 400);
      const body = (await parseBody(request)) as { cols?: number; rows?: number };
      return json(await workspace.resizeTerminal(paneId, body.cols ?? 80, body.rows ?? 24));
    }

    if (url.pathname.startsWith("/api/panes/") && url.pathname.endsWith("/terminal/close") && request.method === "POST") {
      const paneId = getPaneId(url);
      if (!paneId) return json({ error: "Missing pane id" }, 400);
      return json(await workspace.closeTerminal(paneId));
    }

    if (url.pathname === "/api/runtime/codex") {
      return json(await workspace.codexStatus());
    }

    if (url.pathname.startsWith("/api/threads/") && url.pathname.endsWith("/message") && request.method === "POST") {
      const threadId = getThreadId(url);
      if (!threadId) return json({ error: "Missing thread id" }, 400);
      const body = (await parseBody(request)) as { content?: string };
      return json(await workspace.sendMessage(threadId, body.content ?? ""));
    }

    if (url.pathname.startsWith("/api/threads/") && url.pathname.endsWith("/respond") && request.method === "POST") {
      const threadId = getThreadId(url);
      if (!threadId) return json({ error: "Missing thread id" }, 400);
      const body = (await parseBody(request)) as { response?: string };
      return json(await workspace.respondToRequest(threadId, body.response ?? ""));
    }

    if (url.pathname.startsWith("/api/threads/") && url.pathname.endsWith("/resume") && request.method === "POST") {
      const threadId = getThreadId(url);
      if (!threadId) return json({ error: "Missing thread id" }, 400);
      return json(await workspace.resumeThread(threadId));
    }

    if (url.pathname.startsWith("/api/threads/") && url.pathname.endsWith("/close") && request.method === "POST") {
      const threadId = getThreadId(url);
      if (!threadId) return json({ error: "Missing thread id" }, 400);
      return json(await workspace.closeThread(threadId));
    }

    if (url.pathname === "/api/approvals/respond" && request.method === "POST") {
      const body = (await parseBody(request)) as { threadId?: string; decision?: string };
      if (!body.threadId) return json({ error: "Missing thread id" }, 400);
      return json(await workspace.respondToRequest(body.threadId, `Approval response: ${body.decision ?? "approved"}`));
    }

    if (url.pathname === "/api/user-input/respond" && request.method === "POST") {
      const body = (await parseBody(request)) as { threadId?: string; response?: string };
      if (!body.threadId) return json({ error: "Missing thread id" }, 400);
      return json(await workspace.respondToRequest(body.threadId, body.response ?? ""));
    }

    return json({ error: `Unknown route: ${url.pathname}` }, 404);
  },
  websocket: {
    open(socket) {
      sockets.add(socket);
      socket.send(JSON.stringify({ type: "connected" }));
    },
    close(socket) {
      sockets.delete(socket);
    },
  },
});

console.log(`HyprCode server listening on http://127.0.0.1:${server.port}`);
