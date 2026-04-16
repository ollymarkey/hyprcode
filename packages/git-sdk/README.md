# git-sdk

`git-sdk` is a generated JavaScript wrapper around the `git` CLI.

It is generated from `cli-to-js`, with one small post-processing fix for Git's `switch` subcommand so the emitted TypeScript stays valid.

## Usage

```ts
import git, { diff, log, status } from "git-sdk";

const result = await status({ porcelain: true });
const recent = await log({ n: "1", oneline: true });
const unchanged = await diff({ _: ["HEAD", "HEAD"] });
const version = await git({ version: true });
```

Use `_` for positional arguments.

```ts
await diff({ _: ["HEAD~1", "HEAD"] });
```

## Regenerate

```sh
bun run generate
```

The generated wrapper depends on the installed `git` command used during generation.

`git switch` is exported as `switchBranch` because `switch` is a reserved TypeScript keyword.
