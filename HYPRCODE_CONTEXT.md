# HyprCode Context

## Product Intent
- HyprCode is a Codex-first coding workspace inspired by the tiled feel of Hyprland.
- The defining UX is a vertically scrolling dashboard of chat panes in a two-column grid on wide screens.
- Each pane is a self-contained coding session with lightweight project context, message history, and optional terminal access.

## Non-Goals For This Bootstrap
- No cloud sync, remote collaboration, or hosted backend.
- No provider abstraction beyond Codex-first local integration.
- No Tauri runtime in the first implementation.
- No attempt to fully clone either `t3code` or `opencode`; this repo intentionally borrows patterns, not entire product scope.

## Chosen Stack
- Monorepo: Bun workspaces + Turborepo
- Web UI: React + Vite + TanStack Router
- Desktop shell: Electron
- Local backend: Bun HTTP/WebSocket server
- Shared contracts: TypeScript interfaces and runtime validators in `packages/contracts`

### Why Electron First
- The UI is React-first, and `t3code` already demonstrates a practical Electron + Codex split.
- Desktop process management can stay in TypeScript instead of introducing Rust immediately.
- It keeps the first milestone focused on the multi-pane experience instead of desktop runtime abstraction.

## Monorepo Map
- `apps/web`: React dashboard, routing, pane layout state, server integration
- `apps/server`: local-first API, websocket fanout, persisted workspace state, Codex/terminal process orchestration
- `apps/desktop`: Electron main/preload shell that starts the local server and loads the web app
- `packages/contracts`: shared runtime contracts, validators, API DTOs, server event types, desktop IPC types
- `packages/shared`: shared helpers for ids, JSON persistence, date formatting, and state directory resolution
- `packages/ui`: reusable React UI primitives used by the web app

## Runtime Data Flow
1. The React app loads the workspace dashboard from `apps/web`.
2. The dashboard fetches projects, threads, and persisted pane layout from `apps/server`.
3. User actions like creating panes, sending messages, or toggling terminals call local REST endpoints.
4. `apps/server` persists layout/thread state and broadcasts updates over websocket.
5. Codex session work is owned by the server, which is responsible for spawning `codex app-server`, forwarding user input, and routing approval or status events back to the correct pane.
6. The Electron shell starts the server automatically and points the renderer to the local URL.

## Borrowed Reference Patterns
### From `t3code`
- React + Electron monorepo split
- Local server owning Codex process orchestration
- Contracts package between server and clients
- Chat-centric renderer with local-first desktop hydration

### From `opencode`
- Persisted layout and per-session UI state
- Project/workspace metadata patterns
- Terminal UX as an integrated but secondary surface
- Better session and workspace context framing

## Current Milestone
- Bootstrap the monorepo with a functional local server, a two-column dashboard UI, and an Electron shell scaffold.
- Persist workspace panes locally so new sessions can recover active layout and thread bindings.
- Keep Codex and terminal integration minimal but structurally correct.

## Commands
```bash
bun install
bun run dev
bun run dev:server
bun run dev:web
bun run dev:desktop
bun run build
bun run test
bun run typecheck
```

## Conventions For Future Sessions
- Treat `packages/contracts` as the source of truth for server payloads and events.
- Keep top-level UX focused on the multi-pane workspace, not a single active thread route.
- Add new persistent UI state through the workspace layout snapshot shape rather than ad hoc local storage keys.
- Prefer extending the server boundary over moving process logic into the renderer.
- If a new session needs orientation, read this file first and then inspect `apps/server/src/index.ts` and `apps/web/src/main.tsx`.

## Next Milestones
1. Replace seeded demo data with real project discovery and Codex-backed thread hydration.
2. Add richer per-pane terminal behavior and approval/user-input UX.
3. Tighten Electron production packaging and auto-update flows.
4. Evaluate a Tauri port only after the desktop/server contracts have stabilized.
