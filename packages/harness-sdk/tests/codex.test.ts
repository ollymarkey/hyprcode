import type { CodexStreamTurnEvent, Model } from "codex-sdk";
import { describe, expect, test } from "bun:test";
import { createCodexAdapter, mapCodexModelToHarnessModel, mapCodexNotificationToHarnessEvent } from "../src/adapters/codex";

describe("codex adapter", () => {
  test("exposes expected capabilities", () => {
    const adapter = createCodexAdapter({
      client: {} as never,
    });

    expect(adapter.name).toBe("codex");
    expect(adapter.capabilities).toMatchObject({
      canRunPrompt: true,
      canContinueSession: true,
      canStartServer: true,
      canAttachToServer: true,
      canListModels: true,
      canStreamEvents: true,
      canListAgents: false,
      canExportSessions: false,
    });
  });

  test("maps Codex models to harness model info", () => {
    const model = {
      id: "gpt-5.4",
      model: "gpt-5.4",
      displayName: "GPT-5.4",
    } as Model;

    expect(mapCodexModelToHarnessModel(model)).toEqual({
      id: "gpt-5.4",
      name: "GPT-5.4",
    });
  });

  test("maps agent message deltas to text events", () => {
    const event = {
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        delta: "hello",
      },
    } as CodexStreamTurnEvent;

    expect(mapCodexNotificationToHarnessEvent(event)).toEqual({
      type: "text",
      text: "hello",
    });
  });

  test("maps command items to tool-call events", () => {
    const event = {
      method: "item/started",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "commandExecution",
          id: "item-1",
          command: "bun test",
          cwd: "C:\\repo",
          processId: null,
          source: "turn",
          status: "inProgress",
          commandActions: [],
          aggregatedOutput: null,
          exitCode: null,
          durationMs: null,
        },
      },
    } as CodexStreamTurnEvent;

    expect(mapCodexNotificationToHarnessEvent(event)).toEqual({
      type: "tool-call",
      name: "commandExecution",
      input: {
        command: "bun test",
        cwd: "C:\\repo",
      },
    });
  });
});
