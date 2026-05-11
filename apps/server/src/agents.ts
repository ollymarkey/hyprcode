import {
  createCodexAdapter,
  createOpencodeAdapter,
  type HarnessAdapter,
  type HarnessRunRequest,
} from "harness-sdk";
import type { AgentProvider, ReasoningEffort } from "./protocol";

export type AgentRegistry = ReturnType<typeof createAgentRegistry>;

const adapters: Record<AgentProvider, HarnessAdapter> = {
  codex: createCodexAdapter({ ephemeral: false }),
  opencode: createOpencodeAdapter(),
};

function getDefaultAgent(): AgentProvider {
  const configuredAgent = process.env.HYPRCODE_AGENT;

  if (configuredAgent === "codex" || configuredAgent === "opencode") {
    return configuredAgent;
  }

  return "codex";
}

export function createAgentRegistry() {
  return {
    get(provider?: AgentProvider) {
      return adapters[provider ?? getDefaultAgent()];
    },
    getDefaultAgent,
    listAgents() {
      return (Object.entries(adapters) as [AgentProvider, HarnessAdapter][]).map(
        ([id, adapter]) => ({
          id,
          name: adapter.name,
          capabilities: adapter.capabilities,
          isDefault: id === getDefaultAgent(),
        }),
      );
    },
  };
}

export function createRunRequest(input: {
  prompt: string;
  cwd?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  sessionId?: string;
}): HarnessRunRequest {
  return {
    prompt: input.prompt,
    cwd: input.cwd,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    sessionId: input.sessionId,
  };
}
