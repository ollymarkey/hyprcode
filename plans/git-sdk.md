# Git SDK Plan

## Goal

Add a publishable `git-sdk` package to this monorepo using the static generated-wrapper approach from `cli-to-js`.

## Core Decision

Use a generated TypeScript wrapper committed into the repo instead of parsing `git --help` at runtime.

## Why

- stable API surface for consumers
- fast startup with no runtime schema parsing
- reproducible package contents
- simple package shape that fits this monorepo

## Package Shape

- package directory: `packages/git-sdk`
- package name: `git-sdk`
- main source: generated `src/index.ts`
- default export: root `git` command
- named exports: Git subcommands such as `status`, `diff`, `log`, and `clone`

## Tooling

- use `cli-to-js` as a dev dependency for regeneration
- use a package-local `generate` script to rebuild `src/index.ts`
- use `typescript` to emit JS and declaration files into `dist/`
- use `bun test` for smoke tests

## Tests

Focus on non-destructive smoke tests:

- import default and named exports
- run `status({ porcelain: true })`
- run `log({ n: "1", oneline: true })`
- run `diff({ _: ["HEAD", "HEAD"] })`

Avoid tests that mutate repository state.

## Documentation

- document positional argument usage through `_`
- document regeneration with `bun run generate`
- note that command behavior depends on the installed `git`

## Implementation Steps

1. Add the tracked plan
2. Scaffold `packages/git-sdk`
3. Install `cli-to-js` and TypeScript dependencies
4. Generate `src/index.ts` from `git --help` with subcommands enabled
5. Add smoke tests and README
6. Run build, fmt, lint, and tests
