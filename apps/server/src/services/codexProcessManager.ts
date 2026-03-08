import type { ChatMessage, RuntimeSessionState } from "@hyprcode/contracts";

export interface CodexProcessStatus {
  running: boolean;
  pid: number | null;
  lastError: string | null;
}

export function buildCodexLaunchCommand(binaryPath = "codex") {
  return [binaryPath, "app-server"];
}

export function makeSyntheticAssistantMessage(prompt: string): ChatMessage {
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: "assistant",
    createdAt: new Date().toISOString(),
    content: `Codex handoff placeholder: ${prompt}`,
  };
}

export class CodexProcessManager {
  private process: Bun.Subprocess | null = null;
  private status: CodexProcessStatus = {
    running: false,
    pid: null,
    lastError: null,
  };

  async ensureRunning(binaryPath?: string) {
    if (this.process && this.process.exitCode === null) {
      return this.status;
    }

    try {
      const command = buildCodexLaunchCommand(binaryPath);
      this.process = Bun.spawn(command, {
        stdout: "ignore",
        stderr: "pipe",
      });
      this.status = {
        running: true,
        pid: this.process.pid,
        lastError: null,
      };

      void this.captureErrors(this.process);
    } catch (error) {
      this.status = {
        running: false,
        pid: null,
        lastError: error instanceof Error ? error.message : String(error),
      };
    }

    return this.status;
  }

  private async captureErrors(process: Bun.Subprocess) {
    const stderr = process.stderr;
    if (!stderr) return;
    const text = await new Response(stderr).text();
    if (text.trim().length > 0) {
      this.status.lastError = text.trim();
    }
    await process.exited;
    this.status.running = false;
    this.status.pid = null;
  }

  async stop() {
    if (!this.process) return;
    this.process.kill();
    await this.process.exited;
    this.status = {
      running: false,
      pid: null,
      lastError: this.status.lastError,
    };
    this.process = null;
  }

  getStatus() {
    return this.status;
  }

  deriveNextState(lastState: RuntimeSessionState): RuntimeSessionState {
    if (this.status.lastError) return "error";
    return lastState === "connecting" ? "active" : lastState;
  }
}
