import { useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "#/components/ui/command";
import { Check, Maximize2, MessageSquare, Monitor, Square, Terminal, X } from "lucide-react";
import type { WindowType, WorkspaceWindow } from "../types";
import { getWindowTypeIcon } from "./window-icon";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  windows: WorkspaceWindow[];
  activeWorkspaceId: string;
  onFocusWindow: (windowId: string) => void;
  onSpawnWindow: (type: WindowType) => void;
  onCloseWindow: (windowId: string) => void;
  onToggleFullscreen: (windowId: string) => void;
  onApproveAgentRequest: () => void;
  onDenyAgentRequest: () => void;
  onAbortAgentRun: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  windows,
  onFocusWindow,
  onSpawnWindow,
  onCloseWindow,
  onToggleFullscreen,
  onApproveAgentRequest,
  onDenyAgentRequest,
  onAbortAgentRun,
}: CommandPaletteProps) {
  const windowCommands = useMemo(() => {
    return windows.map((window) => ({
      id: window.id,
      title: window.title,
      type: window.type,
      isFullscreen: window.isFullscreen,
    }));
  }, [windows]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Create New">
          <CommandItem onSelect={() => onSpawnWindow("chat")}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>New Chat</span>
            <CommandShortcut>1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => onSpawnWindow("terminal")}>
            <Terminal className="mr-2 h-4 w-4" />
            <span>New Terminal</span>
            <CommandShortcut>2</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => onSpawnWindow("editor")}>
            <Monitor className="mr-2 h-4 w-4" />
            <span>New Editor</span>
            <CommandShortcut>3</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Agent">
          <CommandItem onSelect={onApproveAgentRequest}>
            <Check className="mr-2 h-4 w-4" />
            <span>Approve Agent Request</span>
            <CommandShortcut>Meta + Enter</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={onDenyAgentRequest}>
            <X className="mr-2 h-4 w-4" />
            <span>Deny Agent Request</span>
            <CommandShortcut>Meta + Esc</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={onAbortAgentRun}>
            <Square className="mr-2 h-4 w-4" />
            <span>Abort Agent Run</span>
            <CommandShortcut>Meta + .</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {windowCommands.length > 0 && (
          <CommandGroup heading="Windows">
            {windowCommands.map((window) => {
              const Icon = getWindowTypeIcon(window.type);
              return (
                <CommandItem
                  key={window.id}
                  onSelect={() => onFocusWindow(window.id)}
                  value={`${window.title} ${window.type}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{window.title}</span>
                  <div className="ml-auto flex items-center gap-1">
                    {!window.isFullscreen && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFullscreen(window.id);
                          onOpenChange(false);
                        }}
                        className="p-1 rounded hover:bg-accent"
                        title="Expand"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseWindow(window.id);
                      }}
                      className="p-1 rounded hover:bg-accent hover:text-destructive"
                      title="Close"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
