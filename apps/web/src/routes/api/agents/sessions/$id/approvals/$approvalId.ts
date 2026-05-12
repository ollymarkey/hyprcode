import { createFileRoute } from "@tanstack/react-router";
import { piAgentBridge } from "#/features/agents/server/pi-bridge";

export const Route = createFileRoute("/api/agents/sessions/$id/approvals/$approvalId")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const body = (await request.json()) as { decision?: "approved" | "denied" };
        const event = await piAgentBridge.resolveApproval({
          sessionId: params.id,
          approvalId: params.approvalId,
          decision: body.decision === "approved" ? "approved" : "denied",
        });

        return Response.json(event);
      },
    },
  },
});
