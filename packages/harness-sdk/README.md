# harness-sdk

`harness-sdk` is the shared foundation for integrating AI coding agent harnesses.

It exists to give the rest of the app one stable abstraction layer even when different providers expose very different low-level interfaces.

## Design

`harness-sdk` sits above provider-native integrations.

- provider-native layer: use the best low-level interface for each system
- harness layer: normalize sessions, prompts, streaming, and server lifecycle
- app layer: orchestration and UI remain outside this package

## Why This Exists

Not every agent system should be treated as a plain one-shot CLI.

For example, `opencode` uses a client/server architecture. Its TUI is just one client, which means a durable integration should model:

- starting or attaching to a server
- targeting agents and models
- continuing sessions
- streaming structured events

## Planned Adapters

- `opencode`
- future AI coding agent harnesses

## Planned Package Boundaries

- `harness-sdk`: shared abstractions and normalized adapter contracts
- provider packages such as `opencode-sdk`: provider-specific integration details

## Initial Shared Concepts

- adapters
- capabilities
- run requests and results
- stream events
- server handles
- session summaries
- agent and model metadata

## Non-Goals

- not a full orchestration engine yet
- not tied to a single provider
- not limited to CLI wrappers

## Status

This package currently exports the shared types and contracts that future adapters will implement.

The first wired adapter is `opencode`, backed by `opencode-sdk`.

## Current Usage

```ts
import { createOpencodeAdapter } from "harness-sdk";

const adapter = createOpencodeAdapter();

const result = await adapter.run?.({
  prompt: "summarize the current repository",
});

const models = await adapter.listModels?.();
```

`startServer()` currently manages the `opencode serve` process directly, while command-oriented operations delegate to `opencode-sdk`.
