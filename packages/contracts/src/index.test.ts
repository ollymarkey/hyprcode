import { describe, expect, test } from "bun:test";

import {
  validateProjectSummary,
  validateThreadSummary,
  validateWorkspaceLayoutSnapshot,
} from "./index";

describe("contracts validators", () => {
  test("accepts a valid project summary", () => {
    expect(
      validateProjectSummary({
        id: "project-1",
        name: "HyprCode",
        cwd: "C:/repo/hyprcode",
        branch: "main",
        worktree: null,
        summary: "Primary workspace",
        color: "#ff7a59",
      }),
    ).toBe(true);
  });

  test("accepts a valid thread summary", () => {
    expect(
      validateThreadSummary({
        id: "thread-1",
        projectId: "project-1",
        title: "Bootstrap shell",
        summary: "Set up Electron shell",
        lastActivityAt: new Date().toISOString(),
        model: "gpt-5-codex",
        sessionState: "active",
        branch: "main",
        worktree: null,
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Set up Electron",
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    ).toBe(true);
  });

  test("rejects malformed layout snapshots", () => {
    expect(
      validateWorkspaceLayoutSnapshot({
        version: 2,
        columns: 2,
        focusedPaneId: null,
        panes: [],
        updatedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });
});
