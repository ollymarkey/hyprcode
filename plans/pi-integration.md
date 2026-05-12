# Pi Integration Plan

## Summary
Implement Pi as a Node-side agent runtime for `apps/web`, with chat windows as the primary UI, typed live widgets for Pi activity, and approval-gated frontend source edits. Pi will not inject arbitrary React at runtime; it will either edit hyprcode source files durably or emit typed UI events that hyprcode renders.

Default choices:
- Runtime: TanStack Start Node-side bridge first.
- Autonomy: approval-gated edits.
- Live UI: typed widgets only.
- Persistence: keep browser/TanStack Store state serializable; keep Pi session objects server-side.

## Key Changes
- Add `@earendil-works/pi-coding-agent` to `@hyprcode/web`.
- Add an app-local server bridge, not browser imports:
  - `PiSessionRegistry`: owns live Pi sessions keyed by `agentSessionId`.
  - `PiAgentBridge`: creates sessions, sends prompts, aborts runs, applies approvals, streams events.
  - Use Pi SDK first; keep bridge interface transport-neutral so RPC/Electron can replace it later.
- Add HTTP/SSE endpoints:
  - `POST /api/agents/sessions`: create session for `{ windowId, repoId, cwd }`.
  - `POST /api/agents/sessions/:id/prompt`: send prompt.
  - `POST /api/agents/sessions/:id/abort`: abort active run.
  - `POST /api/agents/sessions/:id/approvals/:approvalId`: approve or deny a gated action.
  - `GET /api/agents/sessions/:id/events`: stream normalized agent events to the client.
- Add frontend agent state beside chat state:
  - `agentSessions`: serializable session metadata per chat window.
  - `agentEvents`: status, tool activity, previews, approvals, errors.
  - `agentCommands`: create/connect session, send prompt, append streamed deltas, resolve approvals.
- Extend chat flow:
  - On first send, ensure a Pi session exists for the chat window.
  - Add the user message immediately.
  - Stream assistant text deltas into a pending assistant message.
  - Show tool/status/approval UI below or above the composer without changing workspace layout rules.

## UI Editing Model
- Give Pi a constrained hyprcode editing surface:
  - Allowed write roots: `apps/web/src/features`, `apps/web/src/components`, `apps/web/src/routes`, and `apps/web/src/styles.css`.
  - Required checks after approved edits: `bun run fmt`, `bun run lint`, and targeted tests when touched files have tests.
- Add approval-gated custom tools around risky actions:
  - `hyprcode_propose_source_edit`: returns changed files, summary, and diff preview.
  - `hyprcode_apply_source_edit`: only runs after user approval.
  - `hyprcode_run_check`: approval-gated for commands outside the known check list.
  - `hyprcode_show_widget`: emits typed UI events such as status, diff preview, command output, or file preview.
- Render live Pi UI through typed components:
  - `AgentActivityStrip`: current model/status/tool activity.
  - `AgentPreviewPanel`: diffs, command output, file previews.
  - `AgentApprovalDialog`: approve/deny source edits and commands.
- Add keyboard-accessible actions:
  - Approve focused agent request.
  - Deny focused agent request.
  - Abort active Pi run.
  - Open current agent activity/preview panel from the command palette.

## Implementation Steps
1. Save this plan as `plans/pi-integration.md` before coding.
2. Create shared agent types for normalized events, session metadata, approval requests, and preview payloads.
3. Build a mock `AgentBridge` and wire `ChatWindow` to it first, proving streaming messages and typed widgets without Pi.
4. Add TanStack Start API/SSE routes and client helpers for session creation, prompts, aborts, approvals, and event streaming.
5. Implement the Pi SDK bridge server-side with per-session cwd, event normalization, and no client-bundled Pi imports.
6. Add approval-gated source-edit tools and typed live-widget tools.
7. Replace the mock bridge with the real Pi bridge behind the same client API.
8. Add UI surfaces inside chat windows for status, previews, approvals, and abort controls.
9. Add command palette entries and shortcut bindings for agent actions.
10. Run `bun run fmt`, `bun run lint`, `bun run check-types`, and relevant tests.

## Test Plan
- Unit tests:
  - Pi event normalization maps `message_update`, tool events, errors, queue updates, and completion into hyprcode event types.
  - Agent store updates append user messages, stream assistant deltas, handle errors, and clear pending approvals.
  - Approval reducer accepts only matching pending approval IDs.
- Integration tests:
  - Creating a chat session opens an event stream and receives mock events.
  - Sending a prompt produces a user message plus streamed assistant response.
  - Denying an edit prevents source mutation and records the denial event.
  - Approving an edit calls the apply path and emits check/status events.
- Manual acceptance:
  - A chat window can ask Pi to modify `apps/web`.
  - Pi proposes a UI edit with a readable diff preview.
  - User approval applies the edit and Vite refreshes the UI.
  - Abort stops an active run without corrupting chat or agent state.

## Assumptions
- Pi sessions run only on the server side; React code never imports Pi directly.
- First implementation targets local development, not deployed multi-user hosting.
- `repoId` is display/context metadata for now; the bridge resolves the actual cwd from a controlled server-side mapping.
- Runtime-generated UI is limited to typed hyprcode widgets; arbitrary generated React components are out of scope for v1.
- Electron support is future work, enabled by keeping the bridge interface transport-neutral.
