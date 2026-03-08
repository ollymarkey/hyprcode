import path from "node:path";
import { mkdir } from "node:fs/promises";

import type { ServerState } from "./seedState";
import { createSeedState } from "./seedState";
import { readJsonFile, resolveStateDirectory, writeJsonFile } from "@hyprcode/shared";

export class JsonWorkspaceStore {
  private readonly filePath: string;
  private readonly rootDir: string;

  constructor(rootDir: string, explicitStateDir?: string) {
    this.rootDir = rootDir;
    const stateDir = resolveStateDirectory(rootDir, explicitStateDir);
    this.filePath = path.join(stateDir, "workspace-state.json");
  }

  async read(): Promise<ServerState> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    return readJsonFile(this.filePath, createSeedState(this.rootDir));
  }

  async write(next: ServerState) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeJsonFile(this.filePath, next);
  }

  get path() {
    return this.filePath;
  }
}
