import { describe, expect, test } from "bun:test";
import git, { diff, log, status } from "../src/index";

describe("git-sdk", () => {
  test("exports command functions", () => {
    expect(typeof git).toBe("function");
    expect(typeof status).toBe("function");
    expect(typeof log).toBe("function");
    expect(typeof diff).toBe("function");
  });

  test("runs git status", async () => {
    const result = await status({ porcelain: true });

    expect(result.exitCode).toBe(0);
    expect(typeof result.stdout).toBe("string");
    expect(typeof result.stderr).toBe("string");
  });

  test("runs git log", async () => {
    const result = await log({ _: ["-1", "--oneline"] });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  test("runs git diff on identical refs", async () => {
    const result = await diff({ _: ["HEAD", "HEAD"] });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("runs git root command", async () => {
    const result = await git({ version: true });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toLowerCase()).toContain("git version");
  });
});
