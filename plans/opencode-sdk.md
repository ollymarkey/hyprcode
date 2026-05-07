# Opencode SDK Plan

## Goal

Create an `opencode` integration that supports both process bootstrapping and direct interaction with the running agent/server.

## Core Decision

Treat `opencode` as a hybrid integration.

- use a CLI wrapper for bootstrapping and operational commands
- use the server-facing API surface as the primary interface for agent interaction

This matches the documented `opencode` architecture where the terminal UI is just one client on top of a client/server system.

## Why

- prompt execution, sessions, and streaming are better modeled through the server than shelling out for every interaction
- local and remote attach flows become the same conceptual operation
- the CLI is still useful for server lifecycle, models, agents, and operational commands

## Recommended Package Split

### `packages/opencode-sdk`

- raw provider-specific integration package
- contains CLI bootstrap helpers and any direct server wiring needed for `opencode`
- should stay close to `opencode` concepts and commands

### `packages/harness-sdk`

- wraps `opencode-sdk` through a normalized adapter
- exposes provider-independent session, prompt, and streaming contracts

## Low-Level Surfaces To Evaluate

1. `opencode` CLI
- `opencode serve`
- `opencode attach <url>`
- `opencode run [message..]`
- `opencode models [provider]`
- `opencode agent`
- `opencode session`

2. Upstream JS SDK
- the upstream repo already contains `@opencode-ai/sdk`
- it exposes `client` and `server` entry points
- this should be evaluated as the primary low-level integration for agent/server communication

## Recommended Integration Strategy

### Phase 1: Discovery and package setup

- inspect the upstream `@opencode-ai/sdk` client and server surfaces
- confirm how sessions, prompts, and streaming are exposed
- map the direct SDK surface to the shared harness abstractions

### Phase 2: CLI coverage

- create a small CLI wrapper using `cli-to-js`
- use it for:
  - starting the server
  - attach-oriented operational flows
  - listing models and agents
  - safe fallback commands

### Phase 3: Server-backed adapter

- implement the real adapter on top of the running server
- normalize:
  - run prompt
  - continue session
  - attach to local or remote server
  - structured event streaming

## Session Model

The adapter should support:

- create or continue a session
- continue the last session
- continue a specific session by id
- attach to an existing running server
- export or import session metadata later if useful

## Server Lifecycle Model

The adapter should think in this order:

1. attach to an existing server if one is already available
2. start a new local server when needed
3. communicate with the agent through the server-facing interface

## Initial API Shape To Target

- `startServer()`
- `attach()`
- `run()`
- `stream()`
- `listAgents()`
- `listModels()`

## Risks

- direct server/API integration may be a better fit than generated CLI wrappers for core interaction
- CLI help parsing may not describe the full protocol surface
- auth and local environment setup may affect smoke tests
- upstream event shapes may need translation before exposing them through `harness-sdk`

## Implementation Steps

1. Add this tracked plan
2. Inspect upstream `@opencode-ai/sdk` source and examples
3. Decide what belongs in `opencode-sdk` versus `harness-sdk`
4. Add a minimal CLI wrapper for operational commands
5. Build the first `harness-sdk` opencode adapter against the server-facing surface
6. Add smoke tests around non-interactive flows
