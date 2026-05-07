import type { InitializeCapabilities } from "./generated/InitializeCapabilities";
import type { InitializeResponse } from "./generated/InitializeResponse";
import type { ServerNotification } from "./generated/ServerNotification";
import type { ThreadListResponse } from "./generated/v2/ThreadListResponse";
import type { ThreadReadResponse } from "./generated/v2/ThreadReadResponse";
import type { ThreadResumeParams } from "./generated/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "./generated/v2/ThreadResumeResponse";
import type { ThreadStartParams } from "./generated/v2/ThreadStartParams";
import type { ThreadStartResponse } from "./generated/v2/ThreadStartResponse";
import type { TurnInterruptResponse } from "./generated/v2/TurnInterruptResponse";
import type { TurnStartParams } from "./generated/v2/TurnStartParams";
import type { TurnStartResponse } from "./generated/v2/TurnStartResponse";
import type { ModelListParams } from "./generated/v2/ModelListParams";
import type { ModelListResponse } from "./generated/v2/ModelListResponse";
import { CodexStdioTransport } from "./transport/stdio";
import type {
  CodexNotificationMessage,
  CodexServerRequestMessage,
  CodexStdioTransportOptions,
  CodexTransport,
} from "./transport/stdio";

export type * from "./generated";
export type { Model } from "./generated/v2/Model";
export { splitJsonl } from "./transport/jsonl";
export {
  CodexStdioTransport,
  CodexTransportError,
  type CodexJsonRpcError,
  type CodexNotificationMessage,
  type CodexRequestId,
  type CodexResponseMessage,
  type CodexServerRequestMessage,
  type CodexStdioTransportOptions,
  type CodexTransport,
} from "./transport/stdio";

export interface CodexClientInfo {
  name: string;
  title: string;
  version: string;
}

export interface CodexAppServerClientOptions extends CodexStdioTransportOptions {
  clientInfo?: CodexClientInfo;
  capabilities?: InitializeCapabilities | null;
  transport?: CodexTransport;
}

export interface CodexStartTurnOptions extends Omit<TurnStartParams, "input"> {
  prompt: string;
}

export type CodexStreamTurnEvent = ServerNotification;

const DEFAULT_CLIENT_INFO: CodexClientInfo = {
  name: "hyprcode",
  title: "hyprcode",
  version: "0.0.0",
};

const isServerNotification = (message: CodexNotificationMessage): message is ServerNotification =>
  typeof message.method === "string";

export class CodexAppServerClient {
  readonly transport: CodexTransport;

  #clientInfo: CodexClientInfo;
  #capabilities: InitializeCapabilities | null;
  #initialized: Promise<InitializeResponse> | null = null;

  constructor(options: CodexAppServerClientOptions = {}) {
    this.transport = options.transport ?? new CodexStdioTransport(options);
    this.#clientInfo = options.clientInfo ?? DEFAULT_CLIENT_INFO;
    this.#capabilities = options.capabilities ?? null;
  }

  initialize(): Promise<InitializeResponse> {
    this.#initialized ??= this.transport
      .request<InitializeResponse>("initialize", {
        clientInfo: this.#clientInfo,
        capabilities: this.#capabilities,
      })
      .then((response) => {
        this.transport.notify("initialized");
        return response;
      });

    return this.#initialized;
  }

  onNotification(listener: (notification: CodexNotificationMessage) => void): () => void {
    return this.transport.onNotification(listener);
  }

  onServerRequest(listener: (request: CodexServerRequestMessage) => void): () => void {
    return this.transport.onServerRequest(listener);
  }

  async startThread(params: ThreadStartParams = {}): Promise<ThreadStartResponse> {
    await this.initialize();

    return this.transport.request<ThreadStartResponse>("thread/start", params);
  }

  async resumeThread(
    threadId: string,
    params: Omit<ThreadResumeParams, "threadId"> = {},
  ): Promise<ThreadResumeResponse> {
    await this.initialize();

    return this.transport.request<ThreadResumeResponse>("thread/resume", {
      ...params,
      threadId,
    });
  }

  async startTurn(options: CodexStartTurnOptions): Promise<TurnStartResponse> {
    await this.initialize();

    const { prompt, ...params } = options;

    return this.transport.request<TurnStartResponse>("turn/start", {
      ...params,
      input: [
        {
          type: "text",
          text: prompt,
          text_elements: [],
        },
      ],
    });
  }

  async *streamTurn(options: CodexStartTurnOptions): AsyncIterable<CodexStreamTurnEvent> {
    await this.initialize();

    const queue: CodexStreamTurnEvent[] = [];
    let wake: (() => void) | null = null;
    let completed = false;
    let turnId: string | null = null;

    const unsubscribe = this.transport.onNotification((message) => {
      if (!isServerNotification(message)) {
        return;
      }

      const event = message;
      const params = event.params as { threadId?: string; turnId?: string; turn?: { id: string } };
      const eventTurnId = params.turnId ?? params.turn?.id;

      if (params.threadId !== options.threadId) {
        return;
      }

      if (turnId && eventTurnId && eventTurnId !== turnId) {
        return;
      }

      if (!turnId && eventTurnId) {
        turnId = eventTurnId;
      }

      queue.push(event);

      if (event.method === "turn/completed") {
        completed = true;
      }

      wake?.();
      wake = null;
    });

    try {
      const turn = await this.startTurn(options);
      turnId = turn.turn.id;

      while (!completed || queue.length > 0) {
        const event = queue.shift();

        if (event) {
          yield event;
          continue;
        }

        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    } finally {
      unsubscribe();
      const wakeReader = wake as unknown as (() => void) | null;
      wakeReader?.();
    }
  }

  async interruptTurn(threadId: string, turnId: string): Promise<TurnInterruptResponse> {
    await this.initialize();

    return this.transport.request<TurnInterruptResponse>("turn/interrupt", {
      threadId,
      turnId,
    });
  }

  async listModels(params: ModelListParams = {}): Promise<ModelListResponse> {
    await this.initialize();

    return this.transport.request<ModelListResponse>("model/list", params);
  }

  async listThreads(params = {}): Promise<ThreadListResponse> {
    await this.initialize();

    return this.transport.request<ThreadListResponse>("thread/list", params);
  }

  async readThread(threadId: string, includeTurns = true): Promise<ThreadReadResponse> {
    await this.initialize();

    return this.transport.request<ThreadReadResponse>("thread/read", {
      threadId,
      includeTurns,
    });
  }

  close(): Promise<void> {
    return this.transport.close();
  }
}

export default CodexAppServerClient;
