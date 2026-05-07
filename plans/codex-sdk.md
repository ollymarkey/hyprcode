# Codex App Server SDK Plan

## Summary

Add a new `packages/codex-sdk` provider package, similar in role to `opencode-sdk`, but built around Codex App Server's JSON-RPC/JSONL protocol rather than a one-shot CLI wrapper.

## Key Changes

- Create `packages/codex-sdk` with build, lint, fmt, typecheck, README, changelog, smoke tests, and exports matching the existing package style.
- Add a generator script that runs `codex app-server generate-ts --out src/generated` and checks generated protocol types into the package.
- Implement a stdio transport client for `codex app-server --listen stdio://`.
- Build a high-level `CodexAppServerClient` with thread, turn, model, and streaming helpers.
- Keep WebSocket support out of the first pass while leaving the transport boundary open for it later.

## Harness Integration

- Add `packages/harness-sdk/src/adapters/codex.ts`.
- Add `codex-sdk` as a `harness-sdk` dependency.
- Export `createCodexAdapter` from `harness-sdk`.
- Map Codex thread and turn primitives into the normalized `HarnessAdapter` shape.

## Test Plan

- Add `codex-sdk` unit tests for JSONL framing, request correlation, notifications, and server requests.
- Add `codex-sdk` smoke coverage for exports and Codex CLI availability.
- Add `harness-sdk` tests for Codex adapter capabilities, model mapping, and stream event mapping.
- Run `bun run fmt`, `bun run lint`, targeted tests, and `bun run check-types`.

## Assumptions

- Package name: `codex-sdk`.
- First implementation targets stable generated App Server protocol types, not `--experimental`.
- First transport is stdio JSONL because it is the documented default local integration path.
