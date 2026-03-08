import { describe, expect, test } from "bun:test";

import { attachThreadToPane, focusPane, removePane } from "./workspaceLayout";

const baseLayout = {
  version: 1 as const,
  columns: 2 as const,
  focusedPaneId: "pane-1",
  updatedAt: new Date().toISOString(),
  panes: [
    {
      id: "pane-1",
      order: 0,
      threadId: "thread-1",
      projectId: "project-1",
      focused: true,
      terminalOpen: false,
      collapsed: false,
      scrollTop: 0,
    },
    {
      id: "pane-2",
      order: 1,
      threadId: null,
      projectId: null,
      focused: false,
      terminalOpen: false,
      collapsed: false,
      scrollTop: 0,
    },
  ],
};

describe("workspace layout helpers", () => {
  test("focuses a pane", () => {
    const next = focusPane(baseLayout, "pane-2");
    expect(next.focusedPaneId).toBe("pane-2");
    expect(next.panes[1]?.focused).toBe(true);
  });

  test("removes a pane and keeps ordering stable", () => {
    const next = removePane(baseLayout, "pane-1");
    expect(next.panes).toHaveLength(1);
    expect(next.panes[0]?.order).toBe(0);
  });

  test("attaches a thread to a pane", () => {
    const next = attachThreadToPane(baseLayout, "pane-2", {
      id: "thread-2",
      projectId: "project-2",
      title: "Two",
      summary: "Test",
      lastActivityAt: new Date().toISOString(),
      model: "gpt-5-codex",
      sessionState: "idle",
      branch: null,
      worktree: null,
      messages: [],
    });
    expect(next.panes[1]?.threadId).toBe("thread-2");
  });
});
