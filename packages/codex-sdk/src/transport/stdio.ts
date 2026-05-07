import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { splitJsonl } from "./jsonl";

export type CodexRequestId = string | number;

export interface CodexJsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface CodexResponseMessage<T = unknown> {
  id: CodexRequestId;
  result?: T;
  error?: CodexJsonRpcError;
}

export interface CodexNotificationMessage<T = unknown> {
  method: string;
  params?: T;
}

export interface CodexServerRequestMessage<T = unknown> extends CodexNotificationMessage<T> {
  id: CodexRequestId;
}

export interface CodexStdioTransportOptions {
  command?: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface CodexTransport {
  request<T>(method: string, params?: unknown): Promise<T>;
  notify(method: string, params?: unknown): void;
  onNotification(listener: Listener<CodexNotificationMessage>): () => void;
  onServerRequest(listener: Listener<CodexServerRequestMessage>): () => void;
  close(): Promise<void>;
}

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

type Listener<T> = (value: T) => void;

export class CodexTransportError extends Error {
  readonly code?: number;
  readonly data?: unknown;

  constructor(message: string, options: { code?: number; data?: unknown } = {}) {
    super(message);
    this.name = "CodexTransportError";
    this.code = options.code;
    this.data = options.data;
  }
}

export class CodexStdioTransport implements CodexTransport {
  readonly child: ChildProcessWithoutNullStreams;

  #buffer = "";
  #nextId = 1;
  #pending = new Map<CodexRequestId, PendingRequest>();
  #notificationListeners = new Set<Listener<CodexNotificationMessage>>();
  #serverRequestListeners = new Set<Listener<CodexServerRequestMessage>>();
  #closeListeners = new Set<Listener<number | null>>();

  constructor(options: CodexStdioTransportOptions = {}) {
    const command = options.command ?? "codex";
    const args = options.args ?? ["app-server", "--listen", "stdio://"];

    this.child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
    });

    this.child.stdout.on("data", (chunk: Buffer) => this.#handleStdout(chunk));
    this.child.stderr.resume();
    this.child.on("error", (error) => this.#rejectAll(error));
    this.child.on("close", (exitCode) => {
      this.#rejectAll(
        new CodexTransportError(`Codex app-server exited with code ${exitCode ?? "unknown"}.`),
      );
      for (const listener of this.#closeListeners) {
        listener(exitCode);
      }
    });
  }

  request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.#nextId++;
    const message = params === undefined ? { id, method } : { id, method, params };

    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.#write(message);
    });
  }

  notify(method: string, params?: unknown): void {
    this.#write(params === undefined ? { method } : { method, params });
  }

  respond(id: CodexRequestId, result: unknown): void {
    this.#write({ id, result });
  }

  respondError(id: CodexRequestId, error: CodexJsonRpcError): void {
    this.#write({ id, error });
  }

  onNotification(listener: Listener<CodexNotificationMessage>): () => void {
    this.#notificationListeners.add(listener);

    return () => this.#notificationListeners.delete(listener);
  }

  onServerRequest(listener: Listener<CodexServerRequestMessage>): () => void {
    this.#serverRequestListeners.add(listener);

    return () => this.#serverRequestListeners.delete(listener);
  }

  onClose(listener: Listener<number | null>): () => void {
    this.#closeListeners.add(listener);

    return () => this.#closeListeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.child.killed || this.child.exitCode !== null) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.child.once("close", () => resolve());
      this.child.stdin.end();
      this.child.kill();
    });
  }

  #write(message: unknown): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #handleStdout(chunk: Buffer): void {
    const result = splitJsonl(this.#buffer, chunk.toString("utf-8"));
    this.#buffer = result.buffer;

    for (const line of result.lines) {
      this.#handleLine(line);
    }
  }

  #handleLine(line: string): void {
    const message = JSON.parse(line) as
      | CodexResponseMessage
      | CodexNotificationMessage
      | CodexServerRequestMessage;

    if ("id" in message && !("method" in message)) {
      this.#handleResponse(message);
      return;
    }

    if ("id" in message && "method" in message) {
      for (const listener of this.#serverRequestListeners) {
        listener(message);
      }
      return;
    }

    if ("method" in message) {
      for (const listener of this.#notificationListeners) {
        listener(message);
      }
    }
  }

  #handleResponse(message: CodexResponseMessage): void {
    const pending = this.#pending.get(message.id);
    if (!pending) {
      return;
    }

    this.#pending.delete(message.id);

    if (message.error) {
      pending.reject(
        new CodexTransportError(message.error.message, {
          code: message.error.code,
          data: message.error.data,
        }),
      );
      return;
    }

    pending.resolve(message.result);
  }

  #rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) {
      pending.reject(error);
    }

    this.#pending.clear();
  }
}
