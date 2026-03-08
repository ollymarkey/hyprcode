import type { ThreadSummary, WorkspaceLayoutSnapshot, WorkspacePane } from "@hyprcode/contracts";

export function sortPanes(panes: WorkspacePane[]) {
  return [...panes].sort((left, right) => left.order - right.order);
}

export function focusPane(layout: WorkspaceLayoutSnapshot, paneId: string): WorkspaceLayoutSnapshot {
  return {
    ...layout,
    focusedPaneId: paneId,
    panes: sortPanes(
      layout.panes.map((pane) => ({
        ...pane,
        focused: pane.id === paneId,
      })),
    ),
  };
}

export function removePane(layout: WorkspaceLayoutSnapshot, paneId: string): WorkspaceLayoutSnapshot {
  const panes = sortPanes(layout.panes.filter((pane) => pane.id !== paneId)).map((pane, index) => ({
    ...pane,
    order: index,
  }));
  const focusedPaneId = layout.focusedPaneId === paneId ? panes[0]?.id ?? null : layout.focusedPaneId;

  return {
    ...layout,
    focusedPaneId,
    panes: panes.map((pane) => ({
      ...pane,
      focused: pane.id === focusedPaneId,
    })),
  };
}

export function attachThreadToPane(
  layout: WorkspaceLayoutSnapshot,
  paneId: string,
  thread: ThreadSummary,
): WorkspaceLayoutSnapshot {
  return {
    ...layout,
    panes: sortPanes(
      layout.panes.map((pane) =>
        pane.id === paneId
          ? {
              ...pane,
              threadId: thread.id,
              projectId: thread.projectId,
            }
          : pane,
      ),
    ),
  };
}

export function setPaneTerminalOpen(
  layout: WorkspaceLayoutSnapshot,
  paneId: string,
  terminalOpen: boolean,
): WorkspaceLayoutSnapshot {
  return {
    ...layout,
    panes: layout.panes.map((pane) =>
      pane.id === paneId
        ? {
            ...pane,
            terminalOpen,
          }
        : pane,
    ),
  };
}
