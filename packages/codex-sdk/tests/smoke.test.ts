import { spawn } from "node:child_process";
import { describe, expect, test } from "bun:test";
import CodexAppServerClient, { CodexStdioTransport, splitJsonl } from "../src/index";

const codexSmokeTest = process.env.CODEX_SDK_RUN_SMOKE === "1" ? test : test.skip;

const runCodex = (args: string[]) =>
  new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const child = spawn("codex", args, { windowsHide: true });

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        exitCode: exitCode ?? 1,
      });
    });
  });

describe("codex-sdk", () => {
  test("exports public SDK pieces", () => {
    expect(typeof CodexAppServerClient).toBe("function");
    expect(typeof CodexStdioTransport).toBe("function");
    expect(typeof splitJsonl).toBe("function");
  });

  codexSmokeTest("runs codex version", async () => {
    const result = await runCodex(["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("codex-cli");
  });

  codexSmokeTest("runs codex app-server generate-ts help", async () => {
    const result = await runCodex(["app-server", "generate-ts", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Generate TypeScript bindings");
  });
});
