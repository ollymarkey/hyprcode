# Harness SDK Plan

## Goal

Add a shared `harness-sdk` package that provides the common abstractions for integrating multiple AI coding agent harnesses.

## Core Decision

Model harnesses as adapter-backed agent systems instead of treating every provider as a plain one-shot CLI.

For `opencode`, this means:

- use the CLI for lifecycle and operational commands
- use the agent/server layer as the primary integration surface for long-lived interaction

## Why

- different harnesses will expose different low-level interfaces
- some providers are CLI-first while others are server-first
- `harness-sdk` should normalize our app-facing contract without forcing every provider into the same transport shape
- `opencode` explicitly uses a client/server architecture where the TUI is only one client

## Package Shape

- package directory: `packages/harness-sdk`
- package name: `harness-sdk`
- main source: `src/index.ts`
- shared types in `src/types.ts`
- adapter entry points under `src/adapters/`
- session and server helpers can be added later under `src/session/` and `src/server/`

## Architecture

Split the system into three layers.

### 1. Provider-native layer

- use the best low-level integration for each provider
- for `opencode`, prefer the server/API surface for agent interaction
- keep provider-specific process bootstrapping concerns out of the shared contract

### 2. Harness layer

- `harness-sdk` owns shared abstractions
- adapters translate provider-specific behavior into normalized harness behavior
- this is the layer the rest of the app should depend on

### 3. App workflow layer

- orchestration, UI state, and multi-agent workflows stay outside the SDK package

## Initial Shared Concepts

- `HarnessAdapter`
- `HarnessAdapterCapabilities`
- `HarnessRunRequest`
- `HarnessRunResult`
- `HarnessStreamEvent`
- `HarnessServerTarget`
- `HarnessServerHandle`
- `HarnessSessionSummary`
- `HarnessAgentInfo`
- `HarnessModelInfo`

## Initial Capability Model

The shared adapter contract should describe whether a provider can:

- run a prompt
- continue a session
- start a server
- attach to a server
- list agents
- list models
- stream structured events
- export or import sessions

## Scope For The First Pass

- create the package scaffold
- document the architecture in the package README
- export shared types only
- avoid hard-coding `opencode` assumptions into the root package API

## Out Of Scope For The First Pass

- full `opencode` adapter implementation
- multi-provider orchestration
- persistence, caching, or retries
- frontend-specific state management

## Implementation Steps

1. Add this tracked plan
2. Scaffold `packages/harness-sdk`
3. Add package README describing the adapter architecture
4. Add shared type definitions and root exports
5. Add an adapter namespace placeholder for future providers
6. Run formatting and linting
