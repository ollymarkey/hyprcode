import { createFileRoute } from "@tanstack/react-router";
import { piAgentBridge } from "#/features/agents/server/pi-bridge";

export const Route = createFileRoute("/api/agents/sessions/$id/prompt")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const body = (await request.json()) as { prompt?: string };
        const event = await piAgentBridge.sendPrompt(params.id, body.prompt ?? "");

        return Response.json(event);
      },
    },
  },
});
