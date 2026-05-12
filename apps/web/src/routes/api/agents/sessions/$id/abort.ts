import { createFileRoute } from "@tanstack/react-router";
import { piAgentBridge } from "#/features/agents/server/pi-bridge";

export const Route = createFileRoute("/api/agents/sessions/$id/abort")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const event = await piAgentBridge.abort(params.id);

        return Response.json(event);
      },
    },
  },
});
