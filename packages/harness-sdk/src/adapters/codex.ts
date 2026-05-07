import { CodexAppServerClient } from "codex-sdk";
import type { CodexStreamTurnEvent, Model } from "codex-sdk";
import type {
  HarnessAdapter,
  HarnessModelInfo,
  HarnessRunRequest,
  HarnessRunResult,
  HarnessStreamEvent,
} from "../types";

export interface CodexAdapterOptions {
  client?: CodexAppServerClient;
  cwd?: string;
  ephemeral?: boolean;
}

export const mapCodexModelToHarnessModel = (model: Model): HarnessModelInfo => ({
  id: model.id,
  name: model.displayName || model.model,
});

export const mapCodexNotificationToHarnessEvent = (
  event: CodexStreamTurnEvent,
): HarnessStreamEvent => {
  if (event.method === "item/agentMessage/delta") {
    return {
      type: "text",
      text: event.params.delta,
    };
  }

  if (event.method === "item/started" || event.method === "item/completed") {
    const item = event.params.item;

    if (item.type === "mcpToolCall") {
      return {
        type: "tool-call",
        name: `${item.server}/${item.tool}`,
        input: item.arguments,
      };
    }

    if (item.type === "dynamicToolCall") {
      return {
        type: "tool-call",
        name: item.namespace ? `${item.namespace}/${item.tool}` : item.tool,
        input: item.arguments,
      };
    }

    if (item.type === "commandExecution") {
      return {
        type: "tool-call",
        name: "commandExecution",
        input: {
          command: item.command,
          cwd: item.cwd,
        },
      };
    }

    return {
      type: "raw",
      event,
    };
  }

  if (event.method === "turn/completed") {
    return {
      type: "status",
      status: event.params.turn.status,
    };
  }

  if (event.method === "turn/started") {
    return {
      type: "status",
      status: event.params.turn.status,
    };
  }

  return {
    type: "raw",
    event,
  };
};

const getThreadId = async (
  client: CodexAppServerClient,
  request: HarnessRunRequest,
  options: CodexAdapterOptions,
): Promise<string> => {
  if (request.sessionId) {
    const response = await client.resumeThread(request.sessionId, {
      cwd: request.cwd ?? options.cwd,
      model: request.model,
    });

    return response.thread.id;
  }

  const response = await client.startThread({
    cwd: request.cwd ?? options.cwd,
    model: request.model,
    ephemeral: options.ephemeral ?? true,
  });

  return response.thread.id;
};

export const createCodexAdapter = (options: CodexAdapterOptions = {}): HarnessAdapter => {
  const client = options.client ?? new CodexAppServerClient();

  return {
    name: "codex",
    capabilities: {
      canRunPrompt: true,
      canContinueSession: true,
      canStartServer: true,
      canAttachToServer: true,
      canListAgents: false,
      canListModels: true,
      canStreamEvents: true,
      canExportSessions: false,
    },
    run: async (request): Promise<HarnessRunResult> => {
      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      let sessionId: string | undefined;

      for await (const event of runCodexStream(client, request, options)) {
        if (event.type === "text") {
          stdout += event.text;
        }

        if (event.type === "status" && event.status === "failed") {
          exitCode = 1;
          stderr = "Codex turn failed.";
        }

        if (event.type === "raw") {
          const rawEvent = event.event as { params?: { threadId?: string } };
          sessionId ??= rawEvent.params?.threadId;
        }
      }

      return {
        stdout,
        stderr,
        exitCode,
        sessionId: sessionId ?? request.sessionId,
      };
    },
    stream: (request) => runCodexStream(client, request, options),
    startServer: async () => {
      await client.initialize();

      return {
        target: { url: "stdio://" },
        stop: () => client.close(),
      };
    },
    attach: async (target) => {
      if (target.url !== "stdio://") {
        throw new Error("Codex adapter v1 only supports attaching to the stdio client transport.");
      }

      await client.initialize();
    },
    listModels: async () => {
      const response = await client.listModels();

      return response.data.map(mapCodexModelToHarnessModel);
    },
  };
};

async function* runCodexStream(
  client: CodexAppServerClient,
  request: HarnessRunRequest,
  options: CodexAdapterOptions,
): AsyncIterable<HarnessStreamEvent> {
  const threadId = await getThreadId(client, request, options);

  yield {
    type: "raw",
    event: {
      method: "thread/selected",
      params: { threadId },
    },
  };

  for await (const event of client.streamTurn({
    threadId,
    prompt: request.prompt,
    cwd: request.cwd ?? options.cwd,
    model: request.model,
  })) {
    yield mapCodexNotificationToHarnessEvent(event);
  }
}
