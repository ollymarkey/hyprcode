import { describe, expect, test } from "bun:test";
import opencode, { agent, models, run, serve } from "../src/index";

describe("opencode-sdk", () => {
  test("exports command functions", () => {
    expect(typeof opencode).toBe("function");
    expect(typeof run).toBe("function");
    expect(typeof serve).toBe("function");
    expect(typeof models).toBe("function");
    expect(typeof agent).toBe("function");
  });

  test("runs opencode root command", async () => {
    const result = await opencode({ version: true });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("1.");
  });

  test("runs opencode run help", async () => {
    const result = await run({ help: true });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("run opencode with a message");
  });

  test("runs opencode serve help", async () => {
    const result = await serve({ help: true });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toLowerCase()).toContain("headless opencode server");
  });

  test("runs opencode agent help", async () => {
    const result = await agent({ help: true });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toLowerCase()).toContain("manage agents");
  });

  test("runs opencode models help", async () => {
    const result = await models({ help: true });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toLowerCase()).toContain("list all available models");
  });
});
