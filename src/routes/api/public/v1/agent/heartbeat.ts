import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/agent/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateAgent, json, jsonError } = await import("@/lib/agent-auth.server");
        const auth = await authenticateAgent(request);
        if (!auth) return jsonError("Invalid agent token", 401);
        return json({ ok: true, orchestrator_id: auth.orchestratorId, server_time: new Date().toISOString() });
      },
    },
  },
});
