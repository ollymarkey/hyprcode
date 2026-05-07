# opencode-sdk

`opencode-sdk` is the provider-specific package for interacting with `opencode`.

It currently exposes a maintained CLI wrapper around the installed `opencode` command. This package is intentionally separate from `harness-sdk` so provider-specific details can evolve without leaking into the shared adapter layer.

## Design

`opencode-sdk` is responsible for low-level `opencode` integration details.

- current focus: CLI wrapper for operational commands
- future focus: direct server or API integration where that is a better fit than shelling out

`cli-to-js` is still used during regeneration as a compatibility check, but the `opencode` help output does not currently produce a clean subcommand wrapper by itself. The checked-in source keeps the package usable until that upstream generation path improves.

## Usage

```ts
import opencode, { agent, models, run, serve } from "opencode-sdk";

const version = await opencode({ version: true });
const help = await run({ help: true });
const availableModels = await models({ _: ["anthropic"] });
const serverHelp = await serve({ help: true });
const agentHelp = await agent({ help: true });
```

Use `_` for positional arguments.

```ts
await run({ _: ["hello from opencode"] });
```

## Regenerate

```sh
bun run generate
```

The wrapper depends on the installed `opencode` command used during generation.
