import { Database } from "bun:sqlite";
import { Effect } from "effect";
import type { HarnessStreamEvent } from "harness-sdk";

export type ChatSessionRecord = {
  id: string;
  windowId: string;
  title: string;
  repoId: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRecord = {
  id: string;
  sessionId: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
};

export type RunRecord = {
  id: string;
  sessionId: string;
  provider: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  error?: string;
};

export type WorkspaceSessionRecord = {
  id: string;
  payloadJson: string;
  updatedAt: string;
};

export type HyprcodeDatabase = ReturnType<typeof createDatabase>;

const now = () => new Date().toISOString();

export function createDatabase(path: string) {
  const db = new Database(path, { create: true });

  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      window_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      repo_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('assistant', 'user')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      created_at TEXT NOT NULL,
      completed_at TEXT,
      error TEXT,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS stream_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      event_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id)
    );

    CREATE TABLE IF NOT EXISTS workspace_sessions (
      id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const upsertSession = db.query<
    ChatSessionRecord,
    [string, string, string, string, string, string]
  >(`
    INSERT INTO chat_sessions (id, window_id, title, repo_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(window_id) DO UPDATE SET
      title = excluded.title,
      repo_id = excluded.repo_id,
      updated_at = excluded.updated_at
    RETURNING
      id,
      window_id as windowId,
      title,
      repo_id as repoId,
      created_at as createdAt,
      updated_at as updatedAt
  `);

  const insertMessage = db.query<ChatMessageRecord, [string, string, string, string, string]>(`
    INSERT INTO chat_messages (id, session_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
    RETURNING
      id,
      session_id as sessionId,
      role,
      content,
      created_at as createdAt
  `);

  const appendMessage = db.query<ChatMessageRecord, [string, string]>(`
    UPDATE chat_messages
    SET content = content || ?
    WHERE id = ? AND role = 'assistant'
    RETURNING
      id,
      session_id as sessionId,
      role,
      content,
      created_at as createdAt
  `);

  const insertRun = db.query<RunRecord, [string, string, string, string, string]>(`
    INSERT INTO agent_runs (id, session_id, provider, prompt, status, created_at)
    VALUES (?, ?, ?, ?, 'running', ?)
    RETURNING
      id,
      session_id as sessionId,
      provider,
      prompt,
      status,
      created_at as createdAt,
      completed_at as completedAt,
      error
  `);

  const completeRun = db.query<RunRecord, [string, string]>(`
    UPDATE agent_runs
    SET status = 'completed', completed_at = ?
    WHERE id = ?
    RETURNING
      id,
      session_id as sessionId,
      provider,
      prompt,
      status,
      created_at as createdAt,
      completed_at as completedAt,
      error
  `);

  const failRun = db.query<RunRecord, [string, string, string]>(`
    UPDATE agent_runs
    SET status = 'failed', completed_at = ?, error = ?
    WHERE id = ?
    RETURNING
      id,
      session_id as sessionId,
      provider,
      prompt,
      status,
      created_at as createdAt,
      completed_at as completedAt,
      error
  `);

  const insertStreamEvent = db.query<unknown, [string, string, string, string]>(`
    INSERT INTO stream_events (id, run_id, event_json, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const listSessions = db.query<ChatSessionRecord, []>(`
    SELECT
      id,
      window_id as windowId,
      title,
      repo_id as repoId,
      created_at as createdAt,
      updated_at as updatedAt
    FROM chat_sessions
    ORDER BY updated_at DESC
  `);

  const listMessages = db.query<ChatMessageRecord, [string]>(`
    SELECT
      id,
      session_id as sessionId,
      role,
      content,
      created_at as createdAt
    FROM chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `);

  const getWorkspaceSession = db.query<WorkspaceSessionRecord | null, [string]>(`
    SELECT
      id,
      payload_json as payloadJson,
      updated_at as updatedAt
    FROM workspace_sessions
    WHERE id = ?
  `);

  const upsertWorkspaceSession = db.query<WorkspaceSessionRecord, [string, string, string]>(`
    INSERT INTO workspace_sessions (id, payload_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
    RETURNING
      id,
      payload_json as payloadJson,
      updated_at as updatedAt
  `);

  return {
    close: () => db.close(),
    upsertSession: (input: { windowId: string; title: string; repoId: string }) =>
      Effect.sync(() => {
        const timestamp = now();

        return upsertSession.get(
          crypto.randomUUID(),
          input.windowId,
          input.title,
          input.repoId,
          timestamp,
          timestamp,
        );
      }),
    createMessage: (input: { sessionId: string; role: "assistant" | "user"; content: string }) =>
      Effect.sync(() =>
        insertMessage.get(crypto.randomUUID(), input.sessionId, input.role, input.content, now()),
      ),
    appendAssistantMessage: (messageId: string, content: string) =>
      Effect.sync(() => appendMessage.get(content, messageId)),
    createRun: (input: { sessionId: string; provider: string; prompt: string }) =>
      Effect.sync(() =>
        insertRun.get(crypto.randomUUID(), input.sessionId, input.provider, input.prompt, now()),
      ),
    completeRun: (runId: string) => Effect.sync(() => completeRun.get(now(), runId)),
    failRun: (runId: string, error: string) => Effect.sync(() => failRun.get(now(), error, runId)),
    saveStreamEvent: (runId: string, event: HarnessStreamEvent) =>
      Effect.sync(() =>
        insertStreamEvent.run(crypto.randomUUID(), runId, JSON.stringify(event), now()),
      ),
    listSessions: () => Effect.sync(() => listSessions.all()),
    listMessages: (sessionId: string) => Effect.sync(() => listMessages.all(sessionId)),
    getWorkspaceSession: (id = "latest") => Effect.sync(() => getWorkspaceSession.get(id)),
    upsertWorkspaceSession: (input: { id?: string; payload: unknown }) =>
      Effect.sync(() =>
        upsertWorkspaceSession.get(input.id ?? "latest", JSON.stringify(input.payload), now()),
      ),
  };
}
