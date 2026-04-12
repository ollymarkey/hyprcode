import { beforeEach, describe, expect, test } from "vitest";
import { chatCommands, chatStore } from "./store";

describe("chat store commands", () => {
  beforeEach(() => {
    chatCommands.reset();
  });

  test("initializes chat windows with a welcome message", () => {
    chatCommands.ensureWindow("window-1", "Planning Copilot", "hyprcode/frontend");

    expect(chatStore.state["window-1"]?.messages).toHaveLength(1);
    expect(chatStore.state["window-1"]?.messages[0]?.role).toBe("assistant");
  });

  test("stores drafts and sends messages", () => {
    chatCommands.setDraft(
      "window-1",
      "Planning Copilot",
      "hyprcode/frontend",
      "Ship the layout",
      "draft",
    );

    expect(chatStore.state["window-1"]?.draftPlainText).toBe("Ship the layout");

    const didSend = chatCommands.sendMessage(
      "window-1",
      "Planning Copilot",
      "hyprcode/frontend",
      "Ship the layout",
      "draft",
    );

    expect(didSend).toBe(true);
    expect(chatStore.state["window-1"]?.messages.at(-1)?.content).toBe("Ship the layout");
    expect(chatStore.state["window-1"]?.draftPlainText).toBe("");
  });

  test("removes chat window state cleanly", () => {
    chatCommands.ensureWindow("window-1", "Planning Copilot", "hyprcode/frontend");
    chatCommands.removeWindow("window-1");

    expect(chatStore.state["window-1"]).toBeUndefined();
  });
});
