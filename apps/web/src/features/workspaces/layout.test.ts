import { describe, expect, test } from "vitest";
import {
  getDefaultTilesForCount,
  getTileCells,
  getTilePreset,
  getTileRect,
  getValidLayoutsForCount,
  isValidTileRect,
  resolveWorkspaceLayout,
  tilesOverlap,
} from "./layout";
import type { WorkspaceState } from "./types";

function createThreeWindowWorkspaceState(): WorkspaceState {
  return {
    activeWorkspaceId: "workspace-1",
    workspaceOrder: ["workspace-1"],
    workspaces: {
      "workspace-1": {
        id: "workspace-1",
        name: "Workspace 1",
        windowIds: ["window-1", "window-2", "window-3"],
        focusedWindowId: "window-1",
      },
    },
    windows: {
      "window-1": {
        id: "window-1",
        title: "Chat 1",
        type: "chat",
        repoId: "repo/one",
        tile: getTileRect("left-half"),
        isFullscreen: false,
      },
      "window-2": {
        id: "window-2",
        title: "Chat 2",
        type: "chat",
        repoId: "repo/two",
        tile: getTileRect("top-right"),
        isFullscreen: false,
      },
      "window-3": {
        id: "window-3",
        title: "Chat 3",
        type: "chat",
        repoId: "repo/three",
        tile: getTileRect("bottom-right"),
        isFullscreen: false,
      },
    },
  };
}

describe("workspace layout helpers", () => {
  test("returns deterministic default layouts", () => {
    expect(getDefaultTilesForCount(1)).toEqual([getTileRect("full")]);
    expect(getDefaultTilesForCount(2)).toEqual([
      getTileRect("left-half"),
      getTileRect("right-half"),
    ]);
    expect(getDefaultTilesForCount(4)).toEqual([
      getTileRect("top-left"),
      getTileRect("top-right"),
      getTileRect("bottom-left"),
      getTileRect("bottom-right"),
    ]);
  });

  test("detects tile overlap correctly", () => {
    expect(tilesOverlap(getTileRect("full"), getTileRect("top-left"))).toBe(true);
    expect(tilesOverlap(getTileRect("left-half"), getTileRect("right-half"))).toBe(false);
  });

  test("maps cells and presets for known layouts", () => {
    expect(getTileCells(getTileRect("left-half"))).toEqual(["0:0", "0:1"]);
    expect(getTilePreset(getTileRect("bottom-right"))).toBe("bottom-right");
    expect(isValidTileRect(getTileRect("top-half"))).toBe(true);
  });

  test("builds valid sparse layouts for partial workspaces", () => {
    expect(getValidLayoutsForCount(2)).toContainEqual(["top-left", "top-right"]);
    expect(getValidLayoutsForCount(3)).toContainEqual(["top-left", "top-right", "bottom-left"]);
  });

  test("resolves a best-fit layout for a pinned window", () => {
    const state = createThreeWindowWorkspaceState();
    const workspace = state.workspaces[state.activeWorkspaceId];
    const [firstWindowId, secondWindowId, thirdWindowId] = workspace.windowIds;
    const resolvedLayout = resolveWorkspaceLayout(
      workspace,
      state.windows,
      firstWindowId,
      "bottom-right",
    );

    expect(resolvedLayout).toBeDefined();

    if (!resolvedLayout) {
      throw new Error("Expected resolved layout");
    }

    expect(getTilePreset(resolvedLayout[firstWindowId])).toBe("bottom-right");
    expect(getTilePreset(resolvedLayout[secondWindowId])).toBeDefined();
    expect(getTilePreset(resolvedLayout[thirdWindowId])).toBeDefined();
  });
});
