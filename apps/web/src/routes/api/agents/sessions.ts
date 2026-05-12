import { createFileRoute } from "@tanstack/react-router";
import { piAgentBridge } from "#/features/agents/server/pi-bridge";
import type { CreateAgentSessionInput } from "#/features/agents/types";

export const Route = createFileRoute("/api/agents/sessions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = (await request.json()) as CreateAgentSessionInput;
        const event = await piAgentBridge.createSession(input);

        return Response.json(event);
      },
    },
  },
});
