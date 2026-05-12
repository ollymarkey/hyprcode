import { createFileRoute } from "@tanstack/react-router";
import { piSessionRegistry } from "#/features/agents/server/session-registry";
import type { NormalizedAgentEvent } from "#/features/agents/types";

export const Route = createFileRoute("/api/agents/sessions/$id/events")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (event: NormalizedAgentEvent) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };

            const record = piSessionRegistry.get(params.id);

            if (record) {
              record.events.forEach(send);
            }

            const unsubscribe = piSessionRegistry.subscribe(params.id, send);
            const keepAlive = setInterval(() => {
              controller.enqueue(encoder.encode(": keep-alive\n\n"));
            }, 15000);

            request.signal.addEventListener(
              "abort",
              () => {
                clearInterval(keepAlive);
                unsubscribe();
                controller.close();
              },
              { once: true },
            );
          },
        });

        return new Response(stream, {
          headers: {
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "content-type": "text/event-stream",
          },
        });
      },
    },
  },
});
