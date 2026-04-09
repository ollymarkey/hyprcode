# hyprcode

hyprcode is an AI-powered coding IDE inspired by Hyprland. It is designed around workspaces, tiled windows, and keyboard-driven workflows so users can move across multiple repositories without being constrained to a single project per workspace.

## Vision

The core interaction model is a horizontally navigated workspace system.

- Workspaces are the top-level navigation unit.
- Each workspace can contain up to 4 tiled windows by default.
- Windows are scoped to individual repositories, not the workspace.
- Users can work on multiple repositories at the same time within the same overall IDE session.
- Every major action must be accessible through programmable keyboard shortcuts.

This makes hyprcode feel closer to a window manager for software development than a traditional IDE.

## Window Model

hyprcode uses a non-overlapping grid layout powered by CSS Grid.

- Windows never overlap.
- Windows can be created from a `New Window` action or keyboard shortcuts.
- Windows can be dragged and dropped within the grid.
- Windows can be resized into supported tiled states only.
- A window can occupy:
  - the full workspace
  - one half horizontally
  - one half vertically
  - one quarter of the workspace
- Users can expand a window to fullscreen within its workspace and then restore it to its prior tiled position.

Horizontal movement between workspaces is a core rule. Vertical overflow may be supported later as an optional behavior, but horizontal overflow should not be part of the base interaction model.

## Window Types

hyprcode will support three window types:

1. Chat
2. Terminal
3. Editor

Each window type should fit into the same tiling and shortcut system so the experience stays consistent regardless of content.

## Frontend Scope

The current phase is frontend-only.

- Build the interface with React and Vite.
- Focus on workspace navigation, tiled layout behavior, drag-and-drop, resize rules, and keyboard shortcuts.
- Delay backend and Electron work until the frontend UX is validated.

## Roadmap

### Phase 1: Product Foundation

- Define the workspace and window interaction model.
- Build the base visual language inspired by Hyprland.
- Document constraints for tiling, resizing, and navigation.

### Phase 2: Frontend Workspace Shell

- Create the workspace container and horizontal workspace switching.
- Implement the tiled grid system for 1, 2, and 4 window states.
- Add window creation, removal, focus states, and fullscreen toggle.
- Add programmable keyboard shortcut infrastructure.

### Phase 3: Chat First

- Ship the chat window as the first functional panel.
- Support multiple chat windows across multiple repositories.
- Refine focus, spawning, swapping, and workspace interactions around chat-first workflows.

### Phase 4: Terminal

- Add terminal windows into the same layout system.
- Preserve repo-level scoping per window.
- Ensure terminal actions also participate in the keyboard shortcut system.

### Phase 5: Editor

- Add editor windows and integrate them into the workspace model.
- Support opening files per repository-scoped window.
- Refine cross-window workflows between chat, terminal, and editor panels.

### Phase 6: Backend

- Add backend services once the frontend interaction model feels right.
- Introduce agent orchestration, persistence, repo context handling, and runtime services.

### Phase 7: Desktop App

- Build the Electron shell after the web frontend is stable.
- Wire native windowing, terminal integration, filesystem access, and desktop packaging.

## Development

Install dependencies:

```bash
bun install
```

Run the app in development:

```bash
bun --bun run dev
```

Build for production:

```bash
bun --bun run build
```

Run tests:

```bash
bun --bun run test
```

## Guiding Principles

- Keyboard-first by default
- Tiled, predictable layouts instead of floating overlap
- Multi-repo workflows as a first-class concept
- Fast workspace switching
- Frontend UX validated before backend complexity is introduced
