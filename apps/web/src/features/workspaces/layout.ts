import type { TilePreset, TileRect, Workspace, WorkspaceState, WorkspaceWindow } from "./types";

export const TILE_PRESETS: Record<TilePreset, TileRect> = {
  full: { x: 0, y: 0, w: 2, h: 2 },
  "left-half": { x: 0, y: 0, w: 1, h: 2 },
  "right-half": { x: 1, y: 0, w: 1, h: 2 },
  "top-half": { x: 0, y: 0, w: 2, h: 1 },
  "bottom-half": { x: 0, y: 1, w: 2, h: 1 },
  "top-left": { x: 0, y: 0, w: 1, h: 1 },
  "top-right": { x: 1, y: 0, w: 1, h: 1 },
  "bottom-left": { x: 0, y: 1, w: 1, h: 1 },
  "bottom-right": { x: 1, y: 1, w: 1, h: 1 },
};

export const TILE_PRESET_ORDER: TilePreset[] = [
  "full",
  "left-half",
  "right-half",
  "top-half",
  "bottom-half",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

const DEFAULT_LAYOUTS: Record<1 | 2 | 3 | 4, TilePreset[]> = {
  1: ["full"],
  2: ["left-half", "right-half"],
  3: ["left-half", "top-right", "bottom-right"],
  4: ["top-left", "top-right", "bottom-left", "bottom-right"],
};

const VALID_LAYOUTS = buildValidLayouts();

export function cloneTile(tile: TileRect): TileRect {
  return { ...tile };
}

export function getTileRect(preset: TilePreset): TileRect {
  return cloneTile(TILE_PRESETS[preset]);
}

export function getTilePreset(tile: TileRect): TilePreset | undefined {
  return TILE_PRESET_ORDER.find((preset) => isSameTile(tile, TILE_PRESETS[preset]));
}

export function isSameTile(a: TileRect, b: TileRect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function isValidTileRect(tile: TileRect): boolean {
  return TILE_PRESET_ORDER.some((preset) => isSameTile(tile, TILE_PRESETS[preset]));
}

export function getWindowStoredTile(window: WorkspaceWindow): TileRect {
  return window.isFullscreen && window.previousTile
    ? cloneTile(window.previousTile)
    : cloneTile(window.tile);
}

export function getWindowDisplayTile(window: WorkspaceWindow): TileRect {
  return window.isFullscreen ? getTileRect("full") : cloneTile(window.tile);
}

export function getTileCells(tile: TileRect): string[] {
  const cells: string[] = [];

  for (let row = tile.y; row < tile.y + tile.h; row += 1) {
    for (let column = tile.x; column < tile.x + tile.w; column += 1) {
      cells.push(`${column}:${row}`);
    }
  }

  return cells;
}

export function tilesOverlap(a: TileRect, b: TileRect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function getValidLayoutsForCount(count: number): TilePreset[][] {
  if (count < 1 || count > 4) {
    return [];
  }

  return VALID_LAYOUTS[count as 1 | 2 | 3 | 4].map((layout) => [...layout]);
}

export function getWorkspaceWindows(state: WorkspaceState, workspaceId: string): WorkspaceWindow[] {
  const workspace = state.workspaces[workspaceId];

  if (!workspace) {
    return [];
  }

  return workspace.windowIds.map((windowId) => state.windows[windowId]).filter(Boolean);
}

export function getDefaultTilesForCount(count: number): TileRect[] {
  if (count < 1 || count > 4) {
    return [];
  }

  return DEFAULT_LAYOUTS[count as 1 | 2 | 3 | 4].map(getTileRect);
}

export function reflowWorkspaceWindows(
  workspace: Workspace,
  windows: Record<string, WorkspaceWindow>,
): Record<string, WorkspaceWindow> {
  const defaultTiles = getDefaultTilesForCount(workspace.windowIds.length);

  if (defaultTiles.length === 0) {
    return windows;
  }

  const nextWindows = { ...windows };

  workspace.windowIds.forEach((windowId, index) => {
    const currentWindow = nextWindows[windowId];

    if (!currentWindow) {
      return;
    }

    nextWindows[windowId] = {
      ...currentWindow,
      tile: cloneTile(defaultTiles[index]),
      previousTile: currentWindow.isFullscreen ? cloneTile(defaultTiles[index]) : undefined,
    };
  });

  return nextWindows;
}

export function findOverlappingWindowIds(
  workspace: Workspace,
  windows: Record<string, WorkspaceWindow>,
  windowId: string,
  tile: TileRect,
): string[] {
  return workspace.windowIds.filter((candidateId) => {
    if (candidateId === windowId) {
      return false;
    }

    const candidate = windows[candidateId];

    if (!candidate) {
      return false;
    }

    return tilesOverlap(getWindowStoredTile(candidate), tile);
  });
}

export function canPlaceTile(
  workspace: Workspace,
  windows: Record<string, WorkspaceWindow>,
  windowId: string,
  tile: TileRect,
): boolean {
  return findOverlappingWindowIds(workspace, windows, windowId, tile).length === 0;
}

export function resolveWorkspaceLayout(
  workspace: Workspace,
  windows: Record<string, WorkspaceWindow>,
  pinnedWindowId: string,
  pinnedPreset: TilePreset,
): Record<string, TileRect> | undefined {
  if (!workspace.windowIds.includes(pinnedWindowId)) {
    return undefined;
  }

  const candidateLayouts = getValidLayoutsForCount(workspace.windowIds.length).filter((layout) =>
    layout.includes(pinnedPreset),
  );

  if (candidateLayouts.length === 0) {
    return undefined;
  }

  const otherWindowIds = workspace.windowIds.filter((windowId) => windowId !== pinnedWindowId);
  const currentPinnedWindow = windows[pinnedWindowId];

  if (!currentPinnedWindow) {
    return undefined;
  }

  let bestLayout: Record<string, TileRect> | undefined;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const layout of candidateLayouts) {
    const otherPresets = layout.filter((preset) => preset !== pinnedPreset);
    const assignments = getPermutations(otherPresets);

    for (const assignment of assignments) {
      const nextLayout: Record<string, TileRect> = {
        [pinnedWindowId]: getTileRect(pinnedPreset),
      };
      let totalCost = getPresetMovementCost(getWindowStoredTile(currentPinnedWindow), pinnedPreset);

      otherWindowIds.forEach((windowId, index) => {
        const window = windows[windowId];
        const preset = assignment[index];

        if (!window || !preset) {
          totalCost = Number.POSITIVE_INFINITY;
          return;
        }

        nextLayout[windowId] = getTileRect(preset);
        totalCost += getPresetMovementCost(getWindowStoredTile(window), preset);
      });

      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestLayout = nextLayout;
      }
    }
  }

  return bestLayout;
}

function buildValidLayouts(): Record<1 | 2 | 3 | 4, TilePreset[][]> {
  return {
    1: getPresetCombinations(1),
    2: getPresetCombinations(2),
    3: getPresetCombinations(3),
    4: getPresetCombinations(4),
  };
}

function getPresetCombinations(count: number): TilePreset[][] {
  const combinations: TilePreset[][] = [];

  function visit(startIndex: number, current: TilePreset[]) {
    if (current.length === count) {
      combinations.push([...current]);
      return;
    }

    for (let index = startIndex; index < TILE_PRESET_ORDER.length; index += 1) {
      const preset = TILE_PRESET_ORDER[index];

      if (
        current.some((candidate) => tilesOverlap(TILE_PRESETS[candidate], TILE_PRESETS[preset]))
      ) {
        continue;
      }

      current.push(preset);
      visit(index + 1, current);
      current.pop();
    }
  }

  visit(0, []);
  return combinations;
}

function getPermutations<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items];
  }

  const permutations: T[][] = [];

  items.forEach((item, index) => {
    const remaining = items.filter((_, candidateIndex) => candidateIndex !== index);

    getPermutations(remaining).forEach((permutation) => {
      permutations.push([item, ...permutation]);
    });
  });

  return permutations;
}

function getPresetMovementCost(currentTile: TileRect, nextPreset: TilePreset): number {
  const nextTile = TILE_PRESETS[nextPreset];

  return (
    Math.abs(currentTile.x - nextTile.x) +
    Math.abs(currentTile.y - nextTile.y) +
    Math.abs(currentTile.w - nextTile.w) +
    Math.abs(currentTile.h - nextTile.h)
  );
}
