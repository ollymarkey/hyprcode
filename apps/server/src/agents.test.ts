import { describe, expect, test } from "bun:test";
import { createAgentRegistry, createRunRequest } from "./agents";

describe("agent registry", () => {
  test("lists available harness providers", () => {
    const agents = createAgentRegistry().listAgents();

    expect(agents.map((agent) => agent.id).sort()).toEqual(["codex", "opencode"]);
  });

  test("forwards reasoning effort into harness run requests", () => {
    const request = createRunRequest({
      prompt: "Build it",
      reasoningEffort: "high",
    });

    expect(request.reasoningEffort).toBe("high");
  });
});
