import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// Agent streams log lines. Accepts { level, message } or { events: [{level,message}, ...] }
export const Route = createFileRoute("/api/public/v1/agent/deployments/$id/logs")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        const { authenticateAgent, json, jsonError } = await import("@/lib/agent-auth.server");
        const auth = await authenticateAgent(request);
        if (!auth) return jsonError("Invalid agent token", 401);
        const body = await request.json().catch(() => null) as
          | { level?: string; message?: string; events?: Array<{ level?: string; message: string }> }
          | null;
        if (!body) return jsonError("body required", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: dep } = await supabaseAdmin
          .from("ai_deployments")
          .select("id, orchestrator_id")
          .eq("id", params.id)
          .maybeSingle();
        if (!dep) return jsonError("deployment not found", 404);
        if (dep.orchestrator_id && dep.orchestrator_id !== auth.orchestratorId) {
          return jsonError("deployment not assigned to this orchestrator", 403);
        }

        const rows = body.events?.length
          ? body.events.map((e) => ({
              deployment_id: params.id,
              level: e.level ?? "info",
              message: e.message,
            }))
          : body.message
            ? [{ deployment_id: params.id, level: body.level ?? "info", message: body.message }]
            : [];
        if (rows.length === 0) return jsonError("no log lines", 400);

        const { error } = await supabaseAdmin.from("ai_deployment_events").insert(rows);
        if (error) return jsonError(error.message, 500);
        return json({ ok: true, ingested: rows.length });
      },
    },
  },
});
