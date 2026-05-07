# codex-sdk

`codex-sdk` is the provider-specific package for interacting with Codex App Server.

It starts `codex app-server` as a long-lived stdio process and communicates with it using newline-delimited JSON messages. The package checks in generated protocol types from `codex app-server generate-ts` so the client and installed Codex CLI agree on the wire shape.

## Usage

```ts
import { CodexAppServerClient } from "codex-sdk";

const client = new CodexAppServerClient();

await client.initialize();

const thread = await client.startThread({
  cwd: process.cwd(),
  ephemeral: true,
});

for await (const event of client.streamTurn({
  threadId: thread.thread.id,
  prompt: "summarize this repository",
})) {
  if (event.method === "item/agentMessage/delta") {
    process.stdout.write(event.params.delta);
  }
}

await client.close();
```

## Regenerate Protocol Types

```sh
bun run generate
```

The generator depends on the installed `codex` command.

## Design

- `CodexStdioTransport` owns process lifecycle and JSONL framing.
- `CodexAppServerClient` owns initialization and typed app-server methods.
- WebSocket support is intentionally left out of the first pass because upstream marks it experimental.
