import { describe, expect, test } from "bun:test";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";

import { CodexProcessManager } from "./codexProcessManager";
import { WorkspaceService } from "./workspaceService";
import { JsonWorkspaceStore } from "../storage/jsonWorkspaceStore";

describe("WorkspaceService", () => {
  test("creates panes and threads", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hyprcode-service-"));
    const service = new WorkspaceService(new JsonWorkspaceStore(root), new CodexProcessManager(), () => undefined);
    const payload = await service.bootstrap();
    const thread = await service.createThread(payload.projects[0]!.id, "Test thread");
    const pane = await service.createPane();

    expect(thread.title).toBe("Test thread");
    expect(pane.id).toContain("pane-");
  });
});
