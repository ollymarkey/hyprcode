import { beforeEach, describe, expect, test } from "vitest";
import { chatCommands } from "#/features/chat/store";
import { agentCommands, agentStore } from "./store";

describe("agent store commands", () => {
  beforeEach(() => {
    chatCommands.reset();
    agentCommands.reset();
  });

  test("streams assistant deltas into chat state", async () => {
    chatCommands.ensureWindow("window-1", "Planning Copilot", "hyprcode/frontend");

    await agentCommands.sendPrompt("window-1", "Planning Copilot", "hyprcode/frontend", "Ship it");

    const agentWindow = agentStore.state.windows["window-1"];
    expect(agentWindow?.sessionId).toBeTruthy();
    expect(agentWindow?.status).toBe("awaiting_approval");
    expect(Object.values(agentWindow?.approvals ?? {})).toHaveLength(1);
  });

  test("approval reducer accepts only matching pending approvals", async () => {
    chatCommands.ensureWindow("window-1", "Planning Copilot", "hyprcode/frontend");
    await agentCommands.sendPrompt("window-1", "Planning Copilot", "hyprcode/frontend", "Ship it");

    const approval = Object.values(agentStore.state.windows["window-1"]?.approvals ?? {})[0];
    expect(approval).toBeDefined();

    const deniedMissing = await agentCommands.resolveApproval("window-1", "missing", "denied");
    expect(deniedMissing).toBe(false);

    const denied = await agentCommands.resolveApproval("window-1", approval!.id, "denied");
    expect(denied).toBe(true);
    expect(agentStore.state.windows["window-1"]?.approvals[approval!.id]?.status).toBe("denied");
  });
});
