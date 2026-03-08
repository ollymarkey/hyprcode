import { describe, expect, test } from "bun:test";

import { buildCodexLaunchCommand, makeSyntheticAssistantMessage } from "./codexProcessManager";

describe("CodexProcessManager helpers", () => {
  test("builds the default launch command", () => {
    expect(buildCodexLaunchCommand()).toEqual(["codex", "app-server"]);
  });

  test("creates a synthetic assistant message", () => {
    const message = makeSyntheticAssistantMessage("Bootstrap the dashboard");
    expect(message.role).toBe("assistant");
    expect(message.content).toContain("Bootstrap the dashboard");
  });
});
