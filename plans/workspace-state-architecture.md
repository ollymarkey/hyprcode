# Workspace State Architecture Plan

## Goal

Create a deterministic, serializable frontend architecture for hyprcode workspaces and tiled windows that works well in TanStack Start today and can be persisted cleanly in Electron later.

## Core Decision

Use TanStack Store as the canonical app-level state layer for workspace layout, window metadata, focus state, and layout commands.

Do not use raw DOM position and size as the source of truth. Store semantic tile placement in grid units so the layout remains predictable, testable, and portable to Electron persistence.

## State Model

Split state into two layers.

### 1. Persistent Layout State

This is the canonical, serializable state that should eventually be saved and restored.

- `workspaces`
- `activeWorkspaceId`
- `windows` within each workspace
- window `type`
- window `repoId`
- tile placement in grid coordinates
- fullscreen state
- previous tile for fullscreen restore
- focused window id per workspace

Suggested shape:

```ts
type WindowType = "chat" | "terminal" | "editor";

type TileRect = {
  x: 0 | 1;
  y: 0 | 1;
  w: 1 | 2;
  h: 1 | 2;
};

type WorkspaceWindow = {
  id: string;
  type: WindowType;
  repoId: string;
  tile: TileRect;
  isFullscreen: boolean;
  previousTile?: TileRect;
};

type Workspace = {
  id: string;
  windowIds: string[];
  focusedWindowId?: string;
};

type WorkspaceState = {
  activeWorkspaceId: string;
  workspaces: Record<string, Workspace>;
  windows: Record<string, WorkspaceWindow>;
};
```

### 2. Ephemeral Interaction State

This state should remain separate from persistent layout state.

- dragging window id
- active drop target
- resize preview target
- pointer interaction flags
- keyboard chord capture state

This keeps the saved layout clean and avoids mixing temporary UI behavior into persisted workspace data.

## Layout Rules

Represent layout using a 2x2 logical grid.

Supported placements:

- full workspace
- left half
- right half
- top half
- bottom half
- top-left quarter
- top-right quarter
- bottom-left quarter
- bottom-right quarter

This directly supports the current product rules:

- no overlapping windows
- up to 4 windows by default
- valid half and quarter states
- simple fullscreen expand and restore

## Command-Driven Updates

All layout changes should happen through commands in the store layer rather than direct component mutation.

Initial commands:

- `createWorkspace`
- `setActiveWorkspace`
- `spawnWindow`
- `closeWindow`
- `focusWindow`
- `moveWindowToTile`
- `swapWindows`
- `resizeWindow`
- `toggleWindowFullscreen`

Benefits:

- drag and drop, keyboard shortcuts, and buttons all share the same logic
- layout rules stay centralized
- invalid states are easier to prevent
- testing is straightforward because commands can be exercised without rendering

## UI Integration

Render workspaces with CSS Grid derived from store state.

- components read from TanStack Store selectors
- the workspace renderer maps each window tile to grid placement
- drag and drop only computes user intent and dispatches commands
- fullscreen uses the same stored tile model and restore metadata

Avoid using `useEffect` for layout synchronization. Prefer deriving the rendered grid directly from store state and dispatching events from user actions.

## Keyboard Shortcuts

Build shortcut handling as another command source into the same store actions.

- shortcuts should not implement layout logic themselves
- shortcuts dispatch store commands such as focus, spawn, move, resize, and fullscreen toggle
- shortcut definitions should remain configurable for future programmable bindings

## Electron Readiness

This model is intentionally aligned with a later Electron shell.

- the workspace state is plain JSON and easy to persist
- Electron can later own filesystem, terminal, and native integrations
- the React frontend can continue owning layout and interaction rules
- repo context stays attached to each window instead of the workspace

## Implementation Steps

### Step 1: Define layout types

- add shared types for tile rects, workspaces, windows, and commands
- codify allowed tile states in one place

### Step 2: Create the TanStack Store workspace module

- add a store for persistent workspace state
- add a separate store or state slice for transient drag and resize interaction state
- expose command functions for all workspace mutations

### Step 3: Build a layout engine utility

- validate tile placements
- resolve swaps and move collisions
- restore previous layout after fullscreen
- keep all rules deterministic and testable

### Step 4: Render a basic workspace shell

- create a workspace viewport component
- render windows from store state through CSS Grid
- support focus and active workspace changes

### Step 5: Add interaction adapters

- wire `New Window`
- wire drag and drop to tile target resolution
- wire resize controls to valid next tile states
- wire fullscreen expand and restore

### Step 6: Add keyboard shortcut plumbing

- define shortcut actions for workspace navigation and window commands
- dispatch the same store commands used by pointer interactions

### Step 7: Verify with tests

- test layout engine rules in isolation
- test store commands for valid transitions
- test fullscreen restore and collision handling

## Out Of Scope For This Plan

- backend persistence
- terminal process management
- editor file models
- Electron APIs

These should come after the frontend workspace model is stable.
