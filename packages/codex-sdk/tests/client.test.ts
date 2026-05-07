import { describe, expect, test } from "bun:test";
import { CodexAppServerClient } from "../src/index";
import type {
  CodexNotificationMessage,
  CodexServerRequestMessage,
  CodexTransport,
} from "../src/transport/stdio";

class MockTransport implements CodexTransport {
  requests: Array<{ method: string; params?: unknown }> = [];
  notifications: Array<{ method: string; params?: unknown }> = [];
  notificationListeners = new Set<(notification: CodexNotificationMessage) => void>();
  serverRequestListeners = new Set<(request: CodexServerRequestMessage) => void>();

  async request<T>(method: string, params?: unknown): Promise<T> {
    this.requests.push({ method, params });

    if (method === "initialize") {
      return {
        userAgent: "mock",
        codexHome: "/tmp/codex",
        platformFamily: "unix",
        platformOs: "linux",
      } as T;
    }

    if (method === "turn/start") {
      return {
        turn: {
          id: "turn-1",
          items: [],
          status: "running",
          error: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
        },
      } as T;
    }

    if (method === "model/list") {
      return {
        data: [],
        nextCursor: null,
      } as T;
    }

    return {} as T;
  }

  notify(method: string, params?: unknown): void {
    this.notifications.push({ method, params });
  }

  onNotification(listener: (notification: CodexNotificationMessage) => void): () => void {
    this.notificationListeners.add(listener);

    return () => this.notificationListeners.delete(listener);
  }

  onServerRequest(listener: (request: CodexServerRequestMessage) => void): () => void {
    this.serverRequestListeners.add(listener);

    return () => this.serverRequestListeners.delete(listener);
  }

  emit(notification: CodexNotificationMessage): void {
    for (const listener of this.notificationListeners) {
      listener(notification);
    }
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

describe("CodexAppServerClient", () => {
  test("initializes once and sends initialized notification", async () => {
    const transport = new MockTransport();
    const client = new CodexAppServerClient({ transport });

    await client.initialize();
    await client.initialize();

    expect(transport.requests.filter((request) => request.method === "initialize")).toHaveLength(1);
    expect(transport.notifications).toEqual([{ method: "initialized", params: undefined }]);
  });

  test("starts turns with text input", async () => {
    const transport = new MockTransport();
    const client = new CodexAppServerClient({ transport });

    await client.startTurn({
      threadId: "thread-1",
      prompt: "hello",
    });

    expect(transport.requests.at(-1)).toEqual({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        input: [
          {
            type: "text",
            text: "hello",
            text_elements: [],
          },
        ],
      },
    });
  });

  test("streams notifications until turn completion", async () => {
    const transport = new MockTransport();
    const client = new CodexAppServerClient({ transport });
    const events: CodexNotificationMessage[] = [];

    const stream = client.streamTurn({
      threadId: "thread-1",
      prompt: "hello",
    });

    const reader = (async () => {
      for await (const event of stream) {
        events.push(event);
      }
    })();

    await new Promise((resolve) => setTimeout(resolve, 0));

    transport.emit({
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        delta: "hello",
      },
    });
    transport.emit({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: {
          id: "turn-1",
        },
      },
    });

    await reader;

    expect(events.map((event) => event.method)).toEqual([
      "item/agentMessage/delta",
      "turn/completed",
    ]);
  });
});
