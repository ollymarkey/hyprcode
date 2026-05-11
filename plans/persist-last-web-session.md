# Persist Last Web Session + Per-Chat Harness Settings

## Summary

Restore `apps/web` from a single latest SQLite-backed workspace snapshot instead of the demo seed. Persist workspace/window layout state plus per-chat harness, model, reasoning, and optional harness session id. Add compact chat controls and send the selected runtime settings with each prompt.

## Implementation

- Add a `workspace_sessions` singleton table in `apps/server` with `id = 'latest'`, `payload_json`, and `updated_at`.
- Add `GET /workspace-session/latest`, `PUT /workspace-session/latest`, and `GET /agents` server endpoints.
- Extend protocol and harness request types with `reasoningEffort`, forwarding it to Codex `effort` where supported.
- Replace the hardcoded web demo state with a minimal fallback workspace and a hydration flow that loads the latest snapshot plus persisted chat messages.
- Debounce snapshot persistence from workspace/chat command mutations.
- Add per-chat shadcn select controls for harness and reasoning.

## Tests

- Cover server snapshot read/write behavior and reasoning request forwarding where practical.
- Cover web fallback creation, snapshot hydration, persistence scheduling, and chat setting updates.
- Run `bun run fmt` and `bun run lint` after implementation.
