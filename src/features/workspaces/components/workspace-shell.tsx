import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useStore } from "@tanstack/react-store";
import { Expand, MessageSquare, Minimize2, Monitor, Plus, Search, Terminal, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import { CommandPalette } from "./command-palette";
import { WindowBody } from "./window-body";
import { getWindowDisplayTile, getWindowStoredTile } from "../layout";
import { matchWorkspaceShortcut } from "../shortcuts";
import {
  workspaceCommands,
  workspaceInteractionCommands,
  workspaceInteractionStore,
  workspaceStore,
} from "../store";
import type { TileRect, WindowType, Workspace, WorkspaceWindow } from "../types";

export default function WorkspaceShell() {
  const [closingWindowIds, setClosingWindowIds] = useState<string[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [dragPreview, setDragPreview] = useState<{
    windowId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    type: WindowType;
    grabOffsetX: number;
    grabOffsetY: number;
  } | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<{
    workspaceId: string;
    windowId: string;
    startX: number;
    startY: number;
    grabOffsetX: number;
    grabOffsetY: number;
  } | null>(null);
  const state = useStore(workspaceStore, (current) => current);
  const interaction = useStore(workspaceInteractionStore, (current) => current);
  const interactionRef = useRef(interaction);
  interactionRef.current = interaction;
  const activeWorkspace = state.workspaces[state.activeWorkspaceId];
  const windows = activeWorkspace.windowIds
    .map((windowId) => state.windows[windowId])
    .filter(Boolean);
  const previewTiles = useMemo(
    () => getDragPreviewTiles(activeWorkspace, state.windows, interaction),
    [activeWorkspace, interaction, state.windows],
  );
  const focusedWindow = activeWorkspace.focusedWindowId
    ? state.windows[activeWorkspace.focusedWindowId]
    : undefined;
  const fullscreenWindow = windows.find((window) => window.isFullscreen);
  const canAddWindow = activeWorkspace.windowIds.length < 4;

  // Sync drag preview position when ref becomes available
  useEffect(() => {
    if (dragPreviewRef.current && dragPreview && dragSessionRef.current) {
      dragPreviewRef.current.style.left = `${dragPreview.x}px`;
      dragPreviewRef.current.style.top = `${dragPreview.y}px`;
    }
  }, [dragPreview]);

  // Filter chat windows based on search query
  const chatWindows = useMemo(() => {
    return windows.filter((w) => w.type === "chat");
  }, [windows]);

  const filteredChats = useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    const query = chatSearchQuery.toLowerCase();
    return chatWindows.filter(
      (w) => w.title.toLowerCase().includes(query) || w.repoId.toLowerCase().includes(query),
    );
  }, [chatWindows, chatSearchQuery]);

  function requestClose(windowId: string) {
    if (closingWindowIds.includes(windowId)) {
      return;
    }

    setClosingWindowIds((current) => [...current, windowId]);

    window.setTimeout(() => {
      workspaceCommands.closeWindow(activeWorkspace.id, windowId);
      setClosingWindowIds((current) => current.filter((id) => id !== windowId));
    }, 180);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;

    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    ) {
      // Allow Command+P even when in inputs
      if (event.key === "p" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      return;
    }

    const action = matchWorkspaceShortcut(event.nativeEvent);

    if (!action) {
      return;
    }

    event.preventDefault();

    switch (action) {
      case "workspace.previous":
        workspaceCommands.cycleWorkspace(-1);
        return;
      case "workspace.next":
        workspaceCommands.cycleWorkspace(1);
        return;
      case "window.spawn.chat":
        workspaceCommands.spawnWindow("chat");
        return;
      case "window.spawn.terminal":
        workspaceCommands.spawnWindow("terminal");
        return;
      case "window.spawn.editor":
        workspaceCommands.spawnWindow("editor");
        return;
      case "window.close":
        if (focusedWindow) {
          requestClose(focusedWindow.id);
        }
        return;
      case "window.fullscreen":
        if (focusedWindow) {
          workspaceCommands.toggleWindowFullscreen(activeWorkspace.id, focusedWindow.id);
        }
        return;
      case "command.open":
        setIsCommandPaletteOpen(true);
        return;
      default:
        return;
    }
  }

  // Track last swap target to prevent rapid flickering
  const lastSwapTargetRef = useRef<string | undefined>(undefined);
  const swapDebounceRef = useRef<number | null>(null);
  const hoverStartTimeRef = useRef<number>(0);
  const HOVER_THRESHOLD_MS = 150; // Must hover for 150ms before swapping

  function updateDragIntent(clientX: number, clientY: number) {
    const session = dragSessionRef.current;

    if (!session) {
      return;
    }

    // Update floating preview position directly via ref for smooth dragging
    if (dragPreviewRef.current) {
      const newX = clientX - session.grabOffsetX;
      const newY = clientY - session.grabOffsetY;
      dragPreviewRef.current.style.left = `${newX}px`;
      dragPreviewRef.current.style.top = `${newY}px`;
    }

    const hoveredElement = document.elementFromPoint(clientX, clientY);
    const hoveredWindow = hoveredElement?.closest<HTMLElement>("[data-window-id]");
    const hoveredWindowId = hoveredWindow?.dataset.windowId;

    // Only update swap target if it's different and we've hovered long enough
    if (hoveredWindowId && hoveredWindowId !== session.windowId) {
      const now = Date.now();

      if (hoveredWindowId !== lastSwapTargetRef.current) {
        // Started hovering a new window - reset timer
        hoverStartTimeRef.current = now;
        lastSwapTargetRef.current = hoveredWindowId;

        // Clear any pending swap
        if (swapDebounceRef.current) {
          window.clearTimeout(swapDebounceRef.current);
        }

        // Set up delayed swap
        swapDebounceRef.current = window.setTimeout(() => {
          if (lastSwapTargetRef.current === hoveredWindowId) {
            workspaceInteractionCommands.setSwapTargetWindow(hoveredWindowId);
          }
        }, HOVER_THRESHOLD_MS);
      }
      return;
    }

    // Clear swap target when not hovering over another window
    if (!hoveredWindowId && lastSwapTargetRef.current !== undefined) {
      if (swapDebounceRef.current) {
        window.clearTimeout(swapDebounceRef.current);
        swapDebounceRef.current = null;
      }
      hoverStartTimeRef.current = 0;
      lastSwapTargetRef.current = undefined;
      workspaceInteractionCommands.clearSwapTarget();
    }
  }

  function stopPointerDrag(clientX?: number, clientY?: number) {
    const session = dragSessionRef.current;

    if (!session) {
      return;
    }

    if (typeof clientX === "number" && typeof clientY === "number") {
      updateDragIntent(clientX, clientY);

      const currentInteraction = interactionRef.current;

      if (currentInteraction.swapTargetWindowId) {
        workspaceCommands.swapWindows(
          session.workspaceId,
          session.windowId,
          currentInteraction.swapTargetWindowId,
        );
      }
    }

    dragSessionRef.current = null;
    setDragPreview(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);
    workspaceInteractionCommands.clear();
  }

  function handlePointerMove(event: PointerEvent | globalThis.PointerEvent) {
    updateDragIntent(event.clientX, event.clientY);
  }

  function handlePointerUp(event: globalThis.PointerEvent) {
    stopPointerDrag(event.clientX, event.clientY);
  }

  function handlePointerCancel() {
    stopPointerDrag();
  }

  function startPointerDrag(
    event: PointerEvent<HTMLElement>,
    workspaceId: string,
    windowId: string,
  ) {
    if (event.button !== 0) {
      return;
    }

    const windowEl = document.querySelector(`[data-window-id="${windowId}"]`) as HTMLElement;
    if (!windowEl) return;

    const rect = windowEl.getBoundingClientRect();
    const windowData = state.windows[windowId];

    event.preventDefault();
    workspaceCommands.focusWindow(workspaceId, windowId);

    // Calculate grab offset from the initial click position within the window
    const grabOffsetX = event.clientX - rect.left;
    const grabOffsetY = event.clientY - rect.top;

    dragSessionRef.current = {
      workspaceId,
      windowId,
      startX: event.clientX,
      startY: event.clientY,
      grabOffsetX,
      grabOffsetY,
    };

    // Initialize drag preview
    setDragPreview({
      windowId,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      title: windowData?.title || "Window",
      type: windowData?.type || "chat",
      grabOffsetX,
      grabOffsetY,
    });

    workspaceInteractionCommands.setDraggingWindow(windowId);
    updateDragIntent(event.clientX, event.clientY);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  }

  return (
    <main className="h-screen overflow-hidden" onKeyDownCapture={handleKeyDown} tabIndex={0}>
      <section className="flex h-full min-h-0 flex-col">
        {/* Minimal Topbar */}
        <div className="workspace-topbar flex min-h-14 items-center gap-4 px-3 py-2 sm:px-4">
          {/* Left: Workspaces */}
          <div className="flex items-center gap-2">
            {state.workspaceOrder.map((workspaceId, index) => {
              const workspace = state.workspaces[workspaceId];
              const isActive = workspace.id === activeWorkspace.id;

              return (
                <Button
                  key={workspace.id}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className="h-8 min-w-8 rounded-full px-3"
                  onClick={() => workspaceCommands.setActiveWorkspace(workspace.id)}
                >
                  {index + 1}
                </Button>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3"
              onClick={() =>
                workspaceCommands.createWorkspace(`Workspace ${state.workspaceOrder.length + 1}`)
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {/* Center: Chat Search */}
          <div className="flex-1 flex justify-center max-w-md mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search chats..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-full bg-muted border-border text-sm"
              />
              {/* Search Results Dropdown */}
              {chatSearchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
                  {filteredChats.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto py-1">
                      {filteredChats.map((chatWindow) => (
                        <button
                          key={chatWindow.id}
                          className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
                          onClick={() => {
                            workspaceCommands.focusWindow(activeWorkspace.id, chatWindow.id);
                            setChatSearchQuery("");
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <MessageSquare className="size-3.5 text-primary" />
                            <span className="text-sm font-medium truncate">{chatWindow.title}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate pl-5">
                            {chatWindow.repoId}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                      No chats found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: New Chat */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-8 rounded-full px-3"
              disabled={!canAddWindow}
              onClick={() => workspaceCommands.spawnWindow("chat")}
            >
              <MessageSquare className="size-4" />
              <span className="ml-1.5 hidden sm:inline">New Chat</span>
            </Button>
          </div>
        </div>

        <div ref={viewportRef} className="relative min-h-0 flex-1 bg-background p-2 sm:p-3">
          <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-3 rounded-[1.5rem]">
            {(fullscreenWindow ? [fullscreenWindow] : windows).map((window) => {
              const tile = getWindowDisplayTile(window);
              const previewTile = previewTiles?.[window.id];

              return (
                <WindowCard
                  key={window.id}
                  workspaceId={activeWorkspace.id}
                  window={window}
                  draggingWindowId={interaction.draggingWindowId}
                  swapTargetWindowId={interaction.swapTargetWindowId}
                  isClosing={closingWindowIds.includes(window.id)}
                  isFocused={focusedWindow?.id === window.id}
                  onStartPointerDrag={startPointerDrag}
                  onRequestClose={requestClose}
                  style={{
                    gridColumn: `${(previewTile ?? tile).x + 1} / span ${(previewTile ?? tile).w}`,
                    gridRow: `${(previewTile ?? tile).y + 1} / span ${(previewTile ?? tile).h}`,
                  }}
                />
              );
            })}

            {!fullscreenWindow && windows.length === 0 ? (
              <div className="col-span-2 row-span-2 flex items-center justify-center rounded-[1.35rem] border border-dashed border-border text-sm text-muted-foreground">
                Add a window to start testing the workspace layout.
              </div>
            ) : null}
          </div>

          {/* Floating drag preview */}
          {dragPreview && (
            <DragPreviewWindow
              ref={dragPreviewRef}
              x={dragPreview.x}
              y={dragPreview.y}
              width={dragPreview.width}
              height={dragPreview.height}
              title={dragPreview.title}
              type={dragPreview.type}
            />
          )}
        </div>
      </section>

      {/* Command Palette */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        windows={windows}
        activeWorkspaceId={activeWorkspace.id}
        onFocusWindow={(windowId) => {
          workspaceCommands.focusWindow(activeWorkspace.id, windowId);
          setIsCommandPaletteOpen(false);
        }}
        onSpawnWindow={(type) => {
          workspaceCommands.spawnWindow(type);
          setIsCommandPaletteOpen(false);
        }}
        onCloseWindow={(windowId) => {
          requestClose(windowId);
          setIsCommandPaletteOpen(false);
        }}
        onToggleFullscreen={(windowId) => {
          workspaceCommands.toggleWindowFullscreen(activeWorkspace.id, windowId);
          setIsCommandPaletteOpen(false);
        }}
      />
    </main>
  );
}

function WindowCard({
  workspaceId,
  window,
  draggingWindowId,
  swapTargetWindowId,
  isClosing,
  isFocused,
  onStartPointerDrag,
  onRequestClose,
  style,
}: {
  workspaceId: string;
  window: WorkspaceWindow;
  draggingWindowId?: string;
  swapTargetWindowId?: string;
  isClosing: boolean;
  isFocused: boolean;
  onStartPointerDrag: (
    event: PointerEvent<HTMLElement>,
    workspaceId: string,
    windowId: string,
  ) => void;
  onRequestClose: (windowId: string) => void;
  style: CSSProperties;
}) {
  const Icon = getWindowTypeIcon(window.type);

  return (
    <div
      data-window-id={window.id}
      className={cn(
        "workspace-window group relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-border bg-card text-foreground shadow-[0_20px_50px_rgba(0,0,0,0.28)]",
        "will-change-[grid-column,grid-row,transform]",
        "transition-[grid-column,grid-row] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "transition-[opacity,border-color,box-shadow,background,transform] duration-200 ease-out",
        isFocused &&
          "border-primary shadow-[0_0_0_1px_hsl(var(--primary)),0_18px_50px_rgba(0,0,0,0.32)]",
        swapTargetWindowId === window.id &&
          "border-primary bg-muted shadow-[0_0_0_1px_hsl(var(--primary)),0_18px_50px_rgba(0,0,0,0.32)] scale-[1.02]",
        isClosing && "workspace-window-exit pointer-events-none",
        draggingWindowId === window.id &&
          "opacity-60 scale-[0.98] shadow-[0_30px_80px_rgba(0,0,0,0.45)] z-10",
      )}
      style={{
        ...style,
        animationDelay: `${(Number.parseInt(window.id.replace(/\D/g, ""), 10) % 5) * 45}ms`,
      }}
      onClick={() => workspaceCommands.focusWindow(workspaceId, window.id)}
    >
      <MinimalWindowHeader
        window={window}
        Icon={Icon}
        workspaceId={workspaceId}
        onStartPointerDrag={onStartPointerDrag}
        onRequestClose={onRequestClose}
      />

      <WindowBody window={window} />
    </div>
  );
}

const DragPreviewWindow = React.forwardRef<
  HTMLDivElement,
  {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    type: WindowType;
  }
>(function DragPreviewWindow({ x, y, width, height, title, type }, ref) {
  const Icon = getWindowTypeIcon(type);

  return (
    <div
      ref={ref}
      className="fixed pointer-events-none z-50 rounded-[1.35rem] border-2 border-primary bg-card text-foreground shadow-[0_30px_100px_rgba(0,0,0,0.6)] overflow-hidden"
      style={{
        left: x,
        top: y,
        width: Math.max(width * 0.85, 200),
        height: Math.max(height * 0.85, 120),
        transform: "scale(1.02) rotate(1deg)",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted">
        <Icon className="size-3.5 text-primary" />
        <span className="text-sm font-medium text-foreground truncate">{title}</span>
      </div>
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Dragging...</div>
      </div>
    </div>
  );
});

function getDragPreviewTiles(
  workspace: Workspace,
  windows: Record<string, WorkspaceWindow>,
  interaction: { draggingWindowId?: string; swapTargetWindowId?: string },
): Record<string, TileRect> | undefined {
  if (
    !interaction.draggingWindowId ||
    !workspace.windowIds.includes(interaction.draggingWindowId)
  ) {
    return undefined;
  }

  if (
    interaction.swapTargetWindowId &&
    interaction.swapTargetWindowId !== interaction.draggingWindowId &&
    workspace.windowIds.includes(interaction.swapTargetWindowId)
  ) {
    const draggingWindow = windows[interaction.draggingWindowId];
    const swapWindow = windows[interaction.swapTargetWindowId];

    if (!draggingWindow || !swapWindow) {
      return undefined;
    }

    return {
      [interaction.draggingWindowId]: getWindowStoredTile(swapWindow),
      [interaction.swapTargetWindowId]: getWindowStoredTile(draggingWindow),
    };
  }

  return undefined;
}

function MinimalWindowHeader({
  window,
  Icon,
  workspaceId,
  onStartPointerDrag,
  onRequestClose,
}: {
  window: WorkspaceWindow;
  Icon: typeof MessageSquare;
  workspaceId: string;
  onStartPointerDrag: (
    event: PointerEvent<HTMLElement>,
    workspaceId: string,
    windowId: string,
  ) => void;
  onRequestClose: (windowId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    // Don't start drag if clicking on interactive elements
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "BUTTON" ||
      target.closest("[data-no-drag]")
    ) {
      return;
    }
    onStartPointerDrag(event, workspaceId, window.id);
  };

  return (
    <div
      ref={dragHandleRef}
      className="shrink-0 flex cursor-grab items-center justify-between border-b border-border px-3 py-1.5 active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex min-w-0 items-center gap-2 flex-1 overflow-hidden">
        <Icon className="size-3.5 text-primary shrink-0" />
        <div className="min-w-0 flex flex-col flex-1 overflow-hidden">
          <EditableWindowTitle windowId={window.id} title={window.title} />
          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-out",
              isHovered ? "max-h-4 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <p className="truncate text-[10px] text-muted-foreground leading-tight">
              {window.repoId}
            </p>
          </div>
        </div>
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-1 text-muted-foreground shrink-0 ml-2">
        {window.isFullscreen ? (
          <button
            data-no-drag
            className="p-1 rounded hover:bg-muted hover:text-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              workspaceCommands.toggleWindowFullscreen(workspaceId, window.id);
            }}
            title="Minimize"
          >
            <Minimize2 className="size-3.5" />
          </button>
        ) : (
          <button
            data-no-drag
            className="p-1 rounded hover:bg-muted hover:text-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              workspaceCommands.toggleWindowFullscreen(workspaceId, window.id);
            }}
            title="Expand"
          >
            <Expand className="size-3.5" />
          </button>
        )}
        <button
          data-no-drag
          className="p-1 rounded hover:bg-muted hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onRequestClose(window.id);
          }}
          title="Close"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function EditableWindowTitle({ windowId, title }: { windowId: string; title: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      workspaceCommands.renameWindow(windowId, trimmed);
    }
    setIsEditing(false);
    setEditValue(trimmed || title);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(title);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        data-no-drag
        className="min-w-0 w-full bg-transparent text-sm font-medium text-foreground outline-none border-b border-primary px-0 py-0 cursor-text"
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      data-no-drag
      className="min-w-0 w-full text-left text-sm font-medium text-foreground truncate hover:text-primary transition-colors"
    >
      {title}
    </button>
  );
}

function getWindowTypeIcon(type: WindowType) {
  switch (type) {
    case "chat":
      return MessageSquare;
    case "terminal":
      return Terminal;
    case "editor":
      return Monitor;
    default:
      return Monitor;
  }
}
