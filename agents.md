# hyprcode Agents

This document defines the product context and implementation rules for agents working on hyprcode.

## Product Summary

hyprcode is an AI-powered coding IDE inspired by the Linux distro Hyprland. The product is built around workspaces and tiled windows rather than a single project-scoped IDE layout.

The current focus is frontend-only. React and Vite will be used first. Backend services and the Electron app will come later, after the frontend interaction model is validated.

## Technology Stack

- hyprcode is built on TanStack Start.
- Use the TanStack stack already present in the app, including TanStack Router, TanStack Query, and TanStack Store.
- Prefer TanStack Store for app-level state management instead of introducing a separate state library for the same responsibilities.
- Use built-in shadcn UI components wherever possible before creating custom primitives.
- Use `@lexical/react` as the default editor foundation for chat windows and other rich text interaction surfaces.
- Use `@chenglou/pretext` for chat text measurement and layout work where accurate sizing is needed without relying on DOM reflow.
- Avoid `useEffect` wherever possible. Prefer declarative data flow, event-driven updates, derived state, and framework-supported patterns first.

## Planning Workflow

- Save implementation plans in the `plans/` directory at the project root.
- When a task needs a plan, create or update a markdown file in `plans/` so the plan is tracked in the repository.
- Always run `bun run fmt` and `bun run lint` at the end of each run.

## Core Product Rules

1. Workspaces are the primary navigation model.
2. Users switch between workspaces horizontally.
3. Horizontal overflow is not part of the default layout model.
4. Vertical overflow can be considered later as an optional enhancement.
5. A workspace can contain up to 4 windows by default.
6. Windows are scoped to repositories, not workspaces.
7. Users must be able to work on multiple repositories at once.
8. Every important action in hyprcode must support programmable keyboard shortcuts.

## Window System

hyprcode uses a tiled grid layout.

- Windows never overlap.
- CSS Grid is the intended implementation approach.
- Users can spawn windows with a `New Window` button or keyboard shortcuts.
- Users can drag and drop windows to rearrange them.
- Users can resize windows only into supported tiled sizes.

Supported window sizes:

- Full workspace
- One half horizontally
- One half vertically
- One quarter

Users must also be able to expand a window so it takes the full workspace temporarily, then restore it to its prior tiled position.

## Window Types

There are three planned window types:

1. Chat
2. Terminal
3. Editor

Implementation priority:

1. Chat first
2. Terminal second
3. Editor third

Chat is the default window experience. New work should assume chat windows are the primary polished surface, built with Lexical for input/composer behavior and Pretext for measured text sizing.

## UX Direction

- The interface should feel keyboard-driven and fast.
- Layout behavior should stay predictable and structured.
- Workspaces should make multi-project development feel natural.
- The product should feel more like a coding window manager than a traditional IDE.
- All UI should be as minimal and sleek as possible. Prefer restraint, strong spacing, and clean surfaces over decorative complexity.

## Frontend Priorities

Agents working on the frontend should prioritize:

1. Workspace navigation
2. Tiled grid layout behavior
3. Window focus management
4. Drag-and-drop rearrangement
5. Resizing within allowed grid states
6. Fullscreen expand and restore behavior
7. Programmable keyboard shortcut infrastructure
8. Chat window UX before terminal and editor UX

## Non-Goals For Now

- Backend agent orchestration
- Persistent server-side session management
- Final repository execution model
- Electron integration
- Native desktop packaging

## Architecture Notes

- Workspaces should be treated as layout containers.
- Windows should carry their own repository context.
- Layout state should be deterministic and easy to serialize later.
- Keyboard shortcuts should be designed as a configurable system, not hardcoded one-offs.
- Frontend components should be built with the later Electron migration in mind.
- Persistent layout state and transient interaction state should remain separate.
- Layout mutations should be command-driven so drag, resize, keyboard shortcuts, and future persistence all use the same rules.
- Chat document state should remain separate from workspace layout state.
- Do not store Lexical editor instances in TanStack Store. Only store serializable chat data such as message content, drafts, and editor snapshots.

## Definition Of Success For The First Frontend Phase

The first frontend phase is successful when:

1. Users can create and manage tiled windows inside horizontally navigated workspaces.
2. Users can rearrange and resize windows within the allowed grid model.
3. Users can expand and restore a window within a workspace.
4. Core actions are available through programmable keyboard shortcuts.
5. The chat window is the first polished and usable window type.
