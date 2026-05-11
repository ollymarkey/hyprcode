import { Store } from "@tanstack/react-store";
import { chatCommands, chatStore, defaultChatRuntimeSettings } from "#/features/chat/store";
import type { ChatMessage } from "#/features/chat/types";
import {
  configureWorkspaceSessionPersistence,
  scheduleWorkspaceSessionPersist,
  type WorkspaceSessionSnapshot,
} from "./session-persistence";
import {
  cloneTile,
  getTileRect,
  getTilePreset,
  getWindowStoredTile,
  isValidTileRect,
  reflowWorkspaceWindows,
  resolveWorkspaceLayout,
} from "./layout";
import type {
  TilePreset,
  TileRect,
  WindowType,
  Workspace,
  WorkspaceInteractionState,
  WorkspaceState,
  WorkspaceWindow,
} from "./types";

const initialInteractionState: WorkspaceInteractionState = {
  keyboardScope: "workspace",
};

function createWindow(
  id: string,
  title: string,
  type: WindowType,
  repoId: string,
  tile: TileRect,
  cwd?: string,
): WorkspaceWindow {
  return {
    id,
    title,
    type,
    repoId,
    cwd,
    tile: cloneTile(tile),
    isFullscreen: false,
  };
}

function createWorkspace(id: string, name: string, windowIds: string[]): Workspace {
  return {
    id,
    name,
    windowIds,
    focusedWindowId: windowIds[0],
  };
}

export function createInitialWorkspaceState(): WorkspaceState {
  const workspaceId = "workspace-1";
  const windowId = "window-1";

  const windows: Record<string, WorkspaceWindow> = {
    [windowId]: createWindow(
      windowId,
      "Chat 1",
      "chat",
      `chat/${workspaceId}`,
      getTileRect("full"),
    ),
  };

  const workspaces = {
    [workspaceId]: createWorkspace(workspaceId, "Workspace 1", [windowId]),
  };

  return {
    activeWorkspaceId: workspaceId,
    workspaceOrder: [workspaceId],
    workspaces,
    windows,
  };
}

export const workspaceStore = new Store<WorkspaceState>(createInitialWorkspaceState());

for (const window of Object.values(workspaceStore.state.windows)) {
  if (window.type === "chat") {
    chatCommands.ensureWindow(window.id, window.title, window.repoId);
  }
}

configureWorkspaceSessionPersistence(createWorkspaceSessionSnapshot);

export const workspaceInteractionStore = new Store<WorkspaceInteractionState>(
  initialInteractionState,
);

function createWindowId(): string {
  return globalThis.crypto.randomUUID();
}

function getWindowTitle(type: WindowType, workspace: Workspace): string {
  const typeLabel = {
    chat: "Chat",
    terminal: "Terminal",
    editor: "Editor",
  }[type];

  return `${typeLabel} ${workspace.windowIds.length + 1}`;
}

function updateStoredWindowTile(window: WorkspaceWindow, tile: TileRect): WorkspaceWindow {
  if (window.isFullscreen) {
    return {
      ...window,
      previousTile: cloneTile(tile),
    };
  }

  return {
    ...window,
    tile: cloneTile(tile),
  };
}

function createWorkspaceSessionSnapshot(): WorkspaceSessionSnapshot {
  const chatSettingsByWindowId = Object.fromEntries(
    Object.values(workspaceStore.state.windows)
      .filter((window) => window.type === "chat")
      .map((window) => [
        window.id,
        chatStore.state[window.id]?.settings ?? defaultChatRuntimeSettings,
      ]),
  );

  return {
    version: 1,
    workspaceState: workspaceStore.state,
    chatSettingsByWindowId,
  };
}

function initializeChatWindows(
  state: WorkspaceState,
  snapshot?: WorkspaceSessionSnapshot | null,
  messagesByWindowId: Record<string, ChatMessage[]> = {},
) {
  chatCommands.reset();

  for (const window of Object.values(state.windows)) {
    if (window.type === "chat") {
      chatCommands.ensureWindow(
        window.id,
        window.title,
        window.repoId,
        snapshot?.chatSettingsByWindowId[window.id],
        messagesByWindowId[window.id],
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkspaceState(value: unknown): value is WorkspaceState {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.activeWorkspaceId === "string" &&
    Array.isArray(value.workspaceOrder) &&
    isRecord(value.workspaces) &&
    isRecord(value.windows)
  ) {
    const workspace = value.workspaces[value.activeWorkspaceId];

    return isRecord(workspace) && Array.isArray(workspace.windowIds);
  }

  return false;
}

export function hydrateWorkspaceSession(
  snapshot: WorkspaceSessionSnapshot | null,
  messagesByWindowId: Record<string, ChatMessage[]> = {},
): { didUseFallback: boolean } {
  const workspaceState = isWorkspaceState(snapshot?.workspaceState)
    ? snapshot.workspaceState
    : createInitialWorkspaceState();

  workspaceStore.setState(() => workspaceState);
  workspaceInteractionCommands.clear();
  initializeChatWindows(workspaceState, snapshot, messagesByWindowId);

  return { didUseFallback: !snapshot };
}

function moveWindowToRect(
  state: WorkspaceState,
  workspaceId: string,
  windowId: string,
  tile: TileRect,
): WorkspaceState {
  const workspace = state.workspaces[workspaceId];
  const currentWindow = state.windows[windowId];
  const preset = getTilePreset(tile);

  if (!workspace || !currentWindow || !isValidTileRect(tile) || !preset) {
    return state;
  }

  const resolvedLayout = resolveWorkspaceLayout(workspace, state.windows, windowId, preset);

  if (!resolvedLayout) {
    return state;
  }

  const nextWindows = { ...state.windows };

  workspace.windowIds.forEach((candidateId) => {
    const window = state.windows[candidateId];
    const nextTile = resolvedLayout[candidateId];

    if (!window || !nextTile) {
      return;
    }

    nextWindows[candidateId] = updateStoredWindowTile(window, nextTile);
  });

  return {
    ...state,
    windows: nextWindows,
  };
}

export const workspaceCommands = {
  createWorkspace(name: string) {
    const workspaceId = createWindowId();
    const chatWindowId = createWindowId();
    const chatWindow = createWindow(
      chatWindowId,
      "Chat 1",
      "chat",
      `chat/${workspaceId}`,
      getTileRect("full"),
    );

    workspaceStore.setState((state) => ({
      ...state,
      activeWorkspaceId: workspaceId,
      workspaceOrder: [...state.workspaceOrder, workspaceId],
      workspaces: {
        ...state.workspaces,
        [workspaceId]: createWorkspace(workspaceId, name, [chatWindowId]),
      },
      windows: {
        ...state.windows,
        [chatWindowId]: chatWindow,
      },
    }));

    chatCommands.ensureWindow(chatWindow.id, chatWindow.title, chatWindow.repoId);
    scheduleWorkspaceSessionPersist();
  },

  setActiveWorkspace(workspaceId: string) {
    workspaceStore.setState((state) => {
      if (!state.workspaces[workspaceId]) {
        return state;
      }

      return {
        ...state,
        activeWorkspaceId: workspaceId,
      };
    });

    scheduleWorkspaceSessionPersist();
  },

  cycleWorkspace(direction: 1 | -1) {
    workspaceStore.setState((state) => {
      if (state.workspaceOrder.length < 2) {
        return state;
      }

      const currentIndex = state.workspaceOrder.indexOf(state.activeWorkspaceId);
      const nextIndex =
        (currentIndex + direction + state.workspaceOrder.length) % state.workspaceOrder.length;

      return {
        ...state,
        activeWorkspaceId: state.workspaceOrder[nextIndex],
      };
    });

    scheduleWorkspaceSessionPersist();
  },

  spawnWindow(type: WindowType, repoId?: string) {
    let spawnedWindow: WorkspaceWindow | undefined;

    workspaceStore.setState((state) => {
      const workspace = state.workspaces[state.activeWorkspaceId];

      if (!workspace || workspace.windowIds.length >= 4) {
        return state;
      }

      const windowId = createWindowId();
      const nextWorkspace: Workspace = {
        ...workspace,
        windowIds: [...workspace.windowIds, windowId],
        focusedWindowId: windowId,
      };

      const nextWindows = reflowWorkspaceWindows(nextWorkspace, {
        ...state.windows,
        [windowId]: createWindow(
          windowId,
          getWindowTitle(type, workspace),
          type,
          repoId ?? `${type}/repo-${workspace.windowIds.length + 1}`,
          getTileRect("full"),
        ),
      });

      spawnedWindow = nextWindows[windowId];

      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [workspace.id]: nextWorkspace,
        },
        windows: nextWindows,
      };
    });

    if (spawnedWindow?.type === "chat") {
      chatCommands.ensureWindow(spawnedWindow.id, spawnedWindow.title, spawnedWindow.repoId);
    }

    scheduleWorkspaceSessionPersist();
  },

  closeWindow(workspaceId: string, windowId: string) {
    const closingWindow = workspaceStore.state.windows[windowId];

    workspaceStore.setState((state) => {
      const workspace = state.workspaces[workspaceId];

      if (!workspace || !workspace.windowIds.includes(windowId)) {
        return state;
      }

      const nextWindowIds = workspace.windowIds.filter((candidateId) => candidateId !== windowId);

      const nextWorkspace: Workspace = {
        ...workspace,
        windowIds: nextWindowIds,
        focusedWindowId:
          workspace.focusedWindowId === windowId ? nextWindowIds[0] : workspace.focusedWindowId,
      };

      const nextWindows = { ...state.windows };
      delete nextWindows[windowId];

      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [workspaceId]: nextWorkspace,
        },
        windows: reflowWorkspaceWindows(nextWorkspace, nextWindows),
      };
    });

    workspaceInteractionStore.setState((state) => ({
      ...state,
      draggingWindowId: state.draggingWindowId === windowId ? undefined : state.draggingWindowId,
    }));

    if (closingWindow?.type === "chat") {
      chatCommands.removeWindow(windowId);
    }

    scheduleWorkspaceSessionPersist();
  },

  focusWindow(workspaceId: string, windowId: string) {
    workspaceStore.setState((state) => {
      const workspace = state.workspaces[workspaceId];

      if (!workspace || !workspace.windowIds.includes(windowId)) {
        return state;
      }

      return {
        ...state,
        workspaces: {
          ...state.workspaces,
          [workspaceId]: {
            ...workspace,
            focusedWindowId: windowId,
          },
        },
      };
    });

    scheduleWorkspaceSessionPersist();
  },

  moveWindowToTile(workspaceId: string, windowId: string, preset: TilePreset) {
    workspaceStore.setState((state) =>
      moveWindowToRect(state, workspaceId, windowId, getTileRect(preset)),
    );
    scheduleWorkspaceSessionPersist();
  },

  swapWindows(workspaceId: string, sourceWindowId: string, targetWindowId: string) {
    workspaceStore.setState((state) => {
      const workspace = state.workspaces[workspaceId];
      const sourceWindow = state.windows[sourceWindowId];
      const targetWindow = state.windows[targetWindowId];

      if (!workspace || !sourceWindow || !targetWindow) {
        return state;
      }

      if (
        !workspace.windowIds.includes(sourceWindowId) ||
        !workspace.windowIds.includes(targetWindowId)
      ) {
        return state;
      }

      return {
        ...state,
        windows: {
          ...state.windows,
          [sourceWindowId]: updateStoredWindowTile(sourceWindow, getWindowStoredTile(targetWindow)),
          [targetWindowId]: updateStoredWindowTile(targetWindow, getWindowStoredTile(sourceWindow)),
        },
      };
    });

    scheduleWorkspaceSessionPersist();
  },

  resizeWindow(workspaceId: string, windowId: string, preset: TilePreset) {
    workspaceStore.setState((state) =>
      moveWindowToRect(state, workspaceId, windowId, getTileRect(preset)),
    );
    scheduleWorkspaceSessionPersist();
  },

  toggleWindowFullscreen(workspaceId: string, windowId: string) {
    workspaceStore.setState((state) => {
      const workspace = state.workspaces[workspaceId];
      const window = state.windows[windowId];

      if (!workspace || !window || !workspace.windowIds.includes(windowId)) {
        return state;
      }

      if (!window.isFullscreen) {
        return {
          ...state,
          windows: {
            ...state.windows,
            [windowId]: {
              ...window,
              isFullscreen: true,
              previousTile: getWindowStoredTile(window),
            },
          },
        };
      }

      return {
        ...state,
        windows: {
          ...state.windows,
          [windowId]: {
            ...window,
            isFullscreen: false,
            tile: cloneTile(window.previousTile ?? window.tile),
            previousTile: undefined,
          },
        },
      };
    });

    scheduleWorkspaceSessionPersist();
  },

  renameWindow(windowId: string, newTitle: string) {
    workspaceStore.setState((state) => {
      const window = state.windows[windowId];

      if (!window) {
        return state;
      }

      return {
        ...state,
        windows: {
          ...state.windows,
          [windowId]: {
            ...window,
            title: newTitle,
          },
        },
      };
    });

    // Also update chat store if it's a chat window
    const window = workspaceStore.state.windows[windowId];
    if (window?.type === "chat") {
      chatCommands.renameWindow(windowId, newTitle);
    }

    scheduleWorkspaceSessionPersist();
  },

  setWindowRepo(windowId: string, repoId: string) {
    workspaceStore.setState((state) => {
      const window = state.windows[windowId];

      if (!window) {
        return state;
      }

      return {
        ...state,
        windows: {
          ...state.windows,
          [windowId]: {
            ...window,
            repoId,
            cwd: repoId,
          },
        },
      };
    });

    const window = workspaceStore.state.windows[windowId];
    if (window?.type === "chat") {
      chatCommands.setRepoContext(windowId, repoId);
      chatCommands.setHarnessSessionId(windowId, undefined);
    }

    scheduleWorkspaceSessionPersist();
  },
};

export const workspaceInteractionCommands = {
  setDraggingWindow(windowId?: string) {
    workspaceInteractionStore.setState((state) => ({
      ...state,
      draggingWindowId: windowId,
      dropTarget: undefined,
    }));
  },

  setDropTarget(dropTarget?: TilePreset) {
    workspaceInteractionStore.setState((state) => ({
      ...state,
      dropTarget,
      swapTargetWindowId: undefined,
    }));
  },

  setSwapTargetWindow(swapTargetWindowId?: string) {
    workspaceInteractionStore.setState((state) => ({
      ...state,
      swapTargetWindowId,
      dropTarget: undefined,
    }));
  },

  clearSwapTarget() {
    workspaceInteractionStore.setState((state) => ({
      ...state,
      swapTargetWindowId: undefined,
    }));
  },

  setResizingWindow(windowId?: string) {
    workspaceInteractionStore.setState((state) => ({
      ...state,
      resizingWindowId: windowId,
    }));
  },

  clear() {
    workspaceInteractionStore.setState(() => initialInteractionState);
  },
};
