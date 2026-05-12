export type WindowType = "chat" | "terminal" | "editor";

export type TilePreset =
  | "full"
  | "left-half"
  | "right-half"
  | "top-half"
  | "bottom-half"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type TileRect = {
  x: 0 | 1;
  y: 0 | 1;
  w: 1 | 2;
  h: 1 | 2;
};

export type WorkspaceWindow = {
  id: string;
  title: string;
  type: WindowType;
  repoId: string;
  tile: TileRect;
  isFullscreen: boolean;
  previousTile?: TileRect;
};

export type Workspace = {
  id: string;
  name: string;
  windowIds: string[];
  focusedWindowId?: string;
};

export type WorkspaceState = {
  activeWorkspaceId: string;
  workspaceOrder: string[];
  workspaces: Record<string, Workspace>;
  windows: Record<string, WorkspaceWindow>;
};

export type WorkspaceInteractionState = {
  draggingWindowId?: string;
  dropTarget?: TilePreset;
  swapTargetWindowId?: string;
  resizingWindowId?: string;
  keyboardScope: "workspace";
};

export type ShortcutAction =
  | "workspace.previous"
  | "workspace.next"
  | "window.spawn.chat"
  | "window.spawn.terminal"
  | "window.spawn.editor"
  | "window.close"
  | "window.fullscreen"
  | "agent.approve"
  | "agent.deny"
  | "agent.abort"
  | "agent.preview"
  | "command.open";

export type ShortcutBinding = {
  action: ShortcutAction;
  description: string;
  keys: {
    key: string;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  };
};
