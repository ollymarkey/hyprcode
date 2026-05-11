import { Effect } from "effect";
import path from "node:path";
import type { ServerWebSocket } from "bun";
import { createAgentRegistry, createRunRequest } from "./agents";
import { createDatabase, type HyprcodeDatabase } from "./database";
import type { ClientMessage, ServerMessage } from "./protocol";

type WebSocketData = {
  id: string;
};

type JsonResponseInput = {
  status?: number;
  headers?: Record<string, string>;
  body: unknown;
};

const jsonResponse = ({ status = 200, headers, body }: JsonResponseInput) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...headers,
    },
  });

const parseClientMessage = (message: string | Buffer): ClientMessage => {
  const rawMessage = typeof message === "string" ? message : new TextDecoder().decode(message);
  return JSON.parse(rawMessage) as ClientMessage;
};

const send = (ws: ServerWebSocket<WebSocketData>, message: ServerMessage) => {
  ws.send(JSON.stringify(message));
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createWebSocketHandler(db: HyprcodeDatabase) {
  const agents = createAgentRegistry();

  return async (ws: ServerWebSocket<WebSocketData>, rawMessage: string | Buffer) => {
    let message: ClientMessage;

    try {
      message = parseClientMessage(rawMessage);
    } catch (error) {
      send(ws, { type: "run-failed", message: getErrorMessage(error) });
      return;
    }

    if (message.type === "ping") {
      send(ws, { type: "pong", serverTime: new Date().toISOString() });
      return;
    }

    try {
      const provider = message.agent ?? agents.getDefaultAgent();
      const adapter = agents.get(provider);

      const session = await Effect.runPromise(
        db.upsertSession({
          windowId: message.windowId,
          title: message.title,
          repoId: message.repoId,
        }),
      );

      if (!session) {
        throw new Error("Unable to create chat session.");
      }

      await Effect.runPromise(
        db.createMessage({
          sessionId: session.id,
          role: "user",
          content: message.prompt,
        }),
      );

      const assistantMessage = await Effect.runPromise(
        db.createMessage({
          sessionId: session.id,
          role: "assistant",
          content: "",
        }),
      );

      const run = await Effect.runPromise(
        db.createRun({
          sessionId: session.id,
          provider: adapter.name,
          prompt: message.prompt,
        }),
      );

      if (!assistantMessage || !run) {
        throw new Error("Unable to create agent run.");
      }

      send(ws, {
        type: "run-started",
        clientRunId: message.clientRunId,
        runId: run.id,
        sessionId: session.id,
        assistantMessageId: assistantMessage.id,
      });

      try {
        const request = createRunRequest({
          prompt: message.prompt,
          cwd: normalizeUserPath(message.cwd),
          model: message.model,
          reasoningEffort: message.reasoningEffort,
          sessionId: message.sessionId,
        });

        if (adapter.stream) {
          for await (const event of adapter.stream(request)) {
            await Effect.runPromise(db.saveStreamEvent(run.id, event));

            if (event.type === "text") {
              await Effect.runPromise(db.appendAssistantMessage(assistantMessage.id, event.text));
            }

            if (event.type === "message" && event.role === "assistant") {
              await Effect.runPromise(
                db.appendAssistantMessage(assistantMessage.id, event.content),
              );
            }

            if (event.type === "status" && event.status === "failed") {
              throw new Error(`${adapter.name} turn failed.`);
            }

            send(ws, {
              type: "stream-event",
              clientRunId: message.clientRunId,
              runId: run.id,
              sessionId: session.id,
              assistantMessageId: assistantMessage.id,
              event,
            });
          }
        } else if (adapter.run) {
          const result = await adapter.run(request);

          if (result.exitCode !== 0) {
            throw new Error(
              result.stderr || `${adapter.name} exited with code ${result.exitCode}.`,
            );
          }

          const text = result.stdout || result.stderr;
          const event = { type: "text" as const, text };

          await Effect.runPromise(db.saveStreamEvent(run.id, event));
          await Effect.runPromise(db.appendAssistantMessage(assistantMessage.id, text));
          send(ws, {
            type: "stream-event",
            clientRunId: message.clientRunId,
            runId: run.id,
            sessionId: session.id,
            assistantMessageId: assistantMessage.id,
            event,
          });
        } else {
          throw new Error(`${adapter.name} cannot run prompts.`);
        }

        await Effect.runPromise(db.completeRun(run.id));

        send(ws, {
          type: "run-completed",
          clientRunId: message.clientRunId,
          runId: run.id,
          sessionId: session.id,
          assistantMessageId: assistantMessage.id,
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        await Effect.runPromise(db.failRun(run.id, errorMessage));

        send(ws, {
          type: "run-failed",
          clientRunId: message.clientRunId,
          runId: run.id,
          sessionId: session.id,
          assistantMessageId: assistantMessage.id,
          message: errorMessage,
        });
      }
    } catch (error) {
      send(ws, {
        type: "run-failed",
        clientRunId: message.type === "run" ? message.clientRunId : undefined,
        message: getErrorMessage(error),
      });
    }
  };
}

function createHttpHandler(db: HyprcodeDatabase, server: Bun.Server<WebSocketData>) {
  const agents = createAgentRegistry();

  return async (request: Request) => {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return jsonResponse({ body: null });
    }

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(request, {
        data: {
          id: crypto.randomUUID(),
        },
      });

      if (upgraded) {
        return undefined;
      }

      return new Response("WebSocket upgrade failed.", { status: 400 });
    }

    if (url.pathname === "/health") {
      return jsonResponse({
        body: {
          ok: true,
          serverTime: new Date().toISOString(),
        },
      });
    }

    if (url.pathname === "/sessions") {
      const sessions = await Effect.runPromise(db.listSessions());
      return jsonResponse({ body: { sessions } });
    }

    if (url.pathname === "/agents") {
      return jsonResponse({ body: { agents: agents.listAgents() } });
    }

    if (url.pathname === "/workspace-session/latest") {
      if (request.method === "GET") {
        const session = await Effect.runPromise(db.getWorkspaceSession("latest"));
        return jsonResponse({
          body: {
            session: session
              ? {
                  id: session.id,
                  payload: JSON.parse(session.payloadJson) as unknown,
                  updatedAt: session.updatedAt,
                }
              : null,
          },
        });
      }

      if (request.method === "PUT") {
        const body = (await request.json()) as { payload?: unknown };

        if (!isValidWorkspaceSessionPayload(body.payload)) {
          return jsonResponse({
            status: 400,
            body: { message: "Invalid workspace session payload." },
          });
        }

        const session = await Effect.runPromise(
          db.upsertWorkspaceSession({ id: "latest", payload: body.payload }),
        );

        return jsonResponse({
          body: {
            session: session
              ? {
                  id: session.id,
                  payload: JSON.parse(session.payloadJson) as unknown,
                  updatedAt: session.updatedAt,
                }
              : null,
          },
        });
      }
    }

    if (url.pathname.startsWith("/sessions/") && url.pathname.endsWith("/messages")) {
      const [, , sessionId] = url.pathname.split("/");

      if (!sessionId) {
        return jsonResponse({ status: 404, body: { message: "Session not found." } });
      }

      const messages = await Effect.runPromise(db.listMessages(sessionId));
      return jsonResponse({ body: { messages } });
    }

    return jsonResponse({ status: 404, body: { message: "Not found." } });
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidWorkspaceSessionPayload(value: unknown): boolean {
  if (!isRecord(value) || value.version !== 1) {
    return false;
  }

  const workspaceState = value.workspaceState;
  const chatSettingsByWindowId = value.chatSettingsByWindowId;

  return isRecord(workspaceState) && isRecord(chatSettingsByWindowId);
}

function normalizeUserPath(input?: string): string | undefined {
  const trimmed = input?.trim();

  if (!trimmed) {
    return undefined;
  }

  const homeDirectory = process.env.USERPROFILE || process.env.HOME || process.cwd();

  if (trimmed === "~") {
    return homeDirectory;
  }

  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.join(homeDirectory, trimmed.slice(2));
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return path.join(homeDirectory, trimmed.slice(1));
  }

  return path.resolve(homeDirectory, trimmed);
}

export function startServer() {
  const port = Number(process.env.PORT ?? 4317);
  const databasePath = process.env.HYPRCODE_DATABASE_PATH ?? "hyprcode.sqlite";

  const program = Effect.sync(() => createDatabase(databasePath)).pipe(
    Effect.map((db) => {
      const handleMessage = createWebSocketHandler(db);
      let server: Bun.Server<WebSocketData>;

      server = Bun.serve<WebSocketData>({
        port,
        fetch: (request) => createHttpHandler(db, server)(request),
        websocket: {
          open: (ws) => {
            send(ws, { type: "connected", serverTime: new Date().toISOString() });
          },
          message: handleMessage,
        },
      });

      console.log(`hyprcode server listening on http://localhost:${server.port}`);
      console.log(`hyprcode websocket listening on ws://localhost:${server.port}/ws`);

      process.once("SIGINT", () => {
        db.close();
        server.stop();
      });

      return server;
    }),
  );

  return Effect.runSync(program);
}
