import type { ShortcutAction, ShortcutBinding } from "./types";

export const workspaceShortcutBindings: ShortcutBinding[] = [
  {
    action: "workspace.previous",
    description: "Previous workspace",
    keys: { key: "[" },
  },
  {
    action: "workspace.next",
    description: "Next workspace",
    keys: { key: "]" },
  },
  {
    action: "window.spawn.chat",
    description: "Spawn chat window",
    keys: { key: "1" },
  },
  {
    action: "window.spawn.terminal",
    description: "Spawn terminal window",
    keys: { key: "2" },
  },
  {
    action: "window.spawn.editor",
    description: "Spawn editor window",
    keys: { key: "3" },
  },
  {
    action: "window.fullscreen",
    description: "Toggle fullscreen window",
    keys: { key: "f" },
  },
  {
    action: "window.close",
    description: "Close focused window",
    keys: { key: "Backspace" },
  },
  {
    action: "agent.approve",
    description: "Approve focused agent request",
    keys: { key: "Enter", metaKey: true },
  },
  {
    action: "agent.deny",
    description: "Deny focused agent request",
    keys: { key: "Escape", metaKey: true },
  },
  {
    action: "agent.abort",
    description: "Abort active Pi run",
    keys: { key: ".", metaKey: true },
  },
  {
    action: "agent.preview",
    description: "Open current agent activity",
    keys: { key: "a", metaKey: true },
  },
  {
    action: "command.open",
    description: "Open command palette",
    keys: { key: "p", metaKey: true },
  },
  {
    action: "command.open",
    description: "Open command palette (Windows/Linux)",
    keys: { key: "p", ctrlKey: true },
  },
];

export function matchWorkspaceShortcut(
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
): ShortcutAction | undefined {
  const matchedBinding = workspaceShortcutBindings.find((binding) => {
    const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const bindingKey =
      binding.keys.key.length === 1 ? binding.keys.key.toLowerCase() : binding.keys.key;

    return (
      normalizedKey === bindingKey &&
      Boolean(event.altKey) === Boolean(binding.keys.altKey) &&
      Boolean(event.ctrlKey) === Boolean(binding.keys.ctrlKey) &&
      Boolean(event.metaKey) === Boolean(binding.keys.metaKey) &&
      Boolean(event.shiftKey) === Boolean(binding.keys.shiftKey)
    );
  });

  return matchedBinding?.action;
}

export function getShortcutLabel(binding: ShortcutBinding): string {
  return [
    binding.keys.ctrlKey ? "Ctrl" : undefined,
    binding.keys.metaKey ? "Meta" : undefined,
    binding.keys.altKey ? "Alt" : undefined,
    binding.keys.shiftKey ? "Shift" : undefined,
    binding.keys.key,
  ]
    .filter(Boolean)
    .join(" + ");
}
