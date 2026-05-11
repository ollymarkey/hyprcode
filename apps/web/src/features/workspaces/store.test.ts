import { beforeEach, describe, expect, test, vi } from "vitest";
import { chatCommands, chatStore } from "#/features/chat/store";
import { getTilePreset } from "./layout";
import {
  createInitialWorkspaceState,
  hydrateWorkspaceSession,
  workspaceCommands,
  workspaceStore,
} from "./store";

vi.mock("./session-persistence", () => ({
  configureWorkspaceSessionPersistence: vi.fn(),
  scheduleWorkspaceSessionPersist: vi.fn(),
}));

describe("workspace store commands", () => {
  beforeEach(() => {
    chatCommands.reset();
    workspaceStore.setState(() => createInitialWorkspaceState());
  });

  test("starts with a single fallback chat window", () => {
    const state = workspaceStore.state;
    const workspace = state.workspaces[state.activeWorkspaceId];

    expect(state.workspaceOrder).toHaveLength(1);
    expect(workspace.windowIds).toHaveLength(1);
    expect(state.windows[workspace.windowIds[0]]?.type).toBe("chat");
    expect(getTilePreset(state.windows[workspace.windowIds[0]].tile)).toBe("full");
  });

  test("spawns windows into the active workspace up to four tiles", () => {
    const initialState = workspaceStore.state;
    const workspace = initialState.workspaces[initialState.activeWorkspaceId];

    workspaceCommands.spawnWindow("chat", "docs-site");

    const nextState = workspaceStore.state;
    const nextWorkspace = nextState.workspaces[nextState.activeWorkspaceId];
    const spawnedWindow = nextState.windows[nextWorkspace.focusedWindowId ?? ""];

    expect(nextWorkspace.windowIds).toHaveLength(workspace.windowIds.length + 1);
    expect(getTilePreset(spawnedWindow.tile)).toBe("right-half");
  });

  test("moves windows into the closest valid layout when a target tile is occupied", () => {
    workspaceCommands.spawnWindow("chat", "docs-site");

    const state = workspaceStore.state;
    const workspace = state.workspaces[state.activeWorkspaceId];
    const [firstWindowId, secondWindowId] = workspace.windowIds;
    const secondPreset = getTilePreset(state.windows[secondWindowId].tile);

    workspaceCommands.moveWindowToTile(workspace.id, firstWindowId, secondPreset!);

    const nextState = workspaceStore.state;
    const nextPresets = [firstWindowId, secondWindowId].map((windowId) =>
      getTilePreset(nextState.windows[windowId].tile),
    );

    expect(nextPresets[0]).toBe(secondPreset);
    expect(new Set(nextPresets).size).toBe(2);
  });

  test("restores previous tile after fullscreen toggle", () => {
    const state = workspaceStore.state;
    const workspace = state.workspaces[state.activeWorkspaceId];
    const windowId = workspace.windowIds[0];
    const originalPreset = getTilePreset(state.windows[windowId].tile);

    workspaceCommands.toggleWindowFullscreen(workspace.id, windowId);
    workspaceCommands.toggleWindowFullscreen(workspace.id, windowId);

    const nextState = workspaceStore.state;

    expect(nextState.windows[windowId].isFullscreen).toBe(false);
    expect(getTilePreset(nextState.windows[windowId].tile)).toBe(originalPreset);
  });

  test("rearranges other windows to satisfy a new target tile", () => {
    workspaceCommands.spawnWindow("chat", "docs-site");
    workspaceCommands.spawnWindow("chat", "api-site");

    const state = workspaceStore.state;
    const workspace = state.workspaces[state.activeWorkspaceId];
    const [firstWindowId, secondWindowId, thirdWindowId] = workspace.windowIds;

    workspaceCommands.moveWindowToTile(workspace.id, firstWindowId, "bottom-right");

    const nextState = workspaceStore.state;
    const nextPresets = [firstWindowId, secondWindowId, thirdWindowId].map((windowId) =>
      getTilePreset(nextState.windows[windowId].tile),
    );

    expect(nextPresets[0]).toBe("bottom-right");
    expect(new Set(nextPresets).size).toBe(3);
  });

  test("new workspaces start with a chat window", () => {
    workspaceCommands.createWorkspace("Workspace 3");

    const nextState = workspaceStore.state;
    const workspace = nextState.workspaces[nextState.activeWorkspaceId];

    expect(workspace.windowIds).toHaveLength(1);
    expect(nextState.windows[workspace.windowIds[0]]?.type).toBe("chat");
  });

  test("hydrates from a persisted workspace session snapshot", () => {
    hydrateWorkspaceSession({
      version: 1,
      workspaceState: {
        activeWorkspaceId: "workspace-restored",
        workspaceOrder: ["workspace-restored"],
        workspaces: {
          "workspace-restored": {
            id: "workspace-restored",
            name: "Restored",
            windowIds: ["window-restored"],
            focusedWindowId: "window-restored",
          },
        },
        windows: {
          "window-restored": {
            id: "window-restored",
            title: "Restored Chat",
            type: "chat",
            repoId: "repo/restored",
            tile: { x: 0, y: 0, w: 2, h: 2 },
            isFullscreen: false,
          },
        },
      },
      chatSettingsByWindowId: {
        "window-restored": {
          harness: "codex",
          reasoningEffort: "high",
        },
      },
    });

    expect(workspaceStore.state.activeWorkspaceId).toBe("workspace-restored");
    expect(chatStore.state["window-restored"]?.settings).toMatchObject({
      harness: "codex",
      reasoningEffort: "high",
    });
  });
});
