import type {
  CreateAgentSessionInput,
  NormalizedAgentEvent,
  ResolveAgentApprovalInput,
} from "./types";

async function postJson<TResponse>(path: string, body?: unknown): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Agent request failed: ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export const agentClientApi = {
  createSession(input: CreateAgentSessionInput) {
    return postJson<NormalizedAgentEvent>("/api/agents/sessions", input);
  },

  sendPrompt(sessionId: string, prompt: string) {
    return postJson<NormalizedAgentEvent>(`/api/agents/sessions/${sessionId}/prompt`, { prompt });
  },

  abort(sessionId: string) {
    return postJson<NormalizedAgentEvent>(`/api/agents/sessions/${sessionId}/abort`);
  },

  resolveApproval(input: ResolveAgentApprovalInput) {
    return postJson<NormalizedAgentEvent>(
      `/api/agents/sessions/${input.sessionId}/approvals/${input.approvalId}`,
      { decision: input.decision },
    );
  },

  connectEvents(sessionId: string, onEvent: (event: NormalizedAgentEvent) => void) {
    const source = new EventSource(`/api/agents/sessions/${sessionId}/events`);

    source.addEventListener("message", (message) => {
      onEvent(JSON.parse(message.data) as NormalizedAgentEvent);
    });

    return () => source.close();
  },
};
