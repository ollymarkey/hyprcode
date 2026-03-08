import { describe, expect, test } from "bun:test";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";

import { JsonWorkspaceStore } from "./jsonWorkspaceStore";

describe("JsonWorkspaceStore", () => {
  test("seeds the workspace state on first read", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyprcode-store-"));
    const store = new JsonWorkspaceStore(root);
    const state = await store.read();

    expect(state.projects.length).toBeGreaterThan(0);
    expect(state.layout.panes.length).toBe(2);
  });
});
