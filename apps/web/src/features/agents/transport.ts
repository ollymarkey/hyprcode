import { agentClientApi } from "./client-api";
import { mockAgentBridge } from "./mock-bridge";
import type { AgentBridge } from "./mock-bridge";

const connectedRealSessions = new Set<string>();

const realAgentBridge: AgentBridge = {
  async createSession(input) {
    return agentClientApi.createSession(input);
  },

  async sendPrompt(input, emit) {
    if (!connectedRealSessions.has(input.sessionId)) {
      connectedRealSessions.add(input.sessionId);
      agentClientApi.connectEvents(input.sessionId, emit);
    }

    await agentClientApi.sendPrompt(input.sessionId, input.prompt);
  },

  async abort(sessionId) {
    return agentClientApi.abort(sessionId);
  },

  async resolveApproval(input) {
    return agentClientApi.resolveApproval(input);
  },
};

export function getAgentBridge(): AgentBridge {
  return import.meta.env.VITE_HYPRCODE_AGENT_BRIDGE === "real" ? realAgentBridge : mockAgentBridge;
}
