import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// Agent posts status transitions: building | running | failed | stopped
export const Route = createFileRoute("/api/public/v1/agent/deployments/$id/status")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        const { authenticateAgent, json, jsonError } = await import("@/lib/agent-auth.server");
        const auth = await authenticateAgent(request);
        if (!auth) return jsonError("Invalid agent token", 401);
        const body = await request.json().catch(() => null) as
          | { status?: string; container_id?: string; host?: string; error?: string }
          | null;
        if (!body?.status) return jsonError("status required", 400);
        const allowed = ["pending", "building", "running", "failed", "stopped"];
        if (!allowed.includes(body.status)) return jsonError("invalid status", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Verify deployment belongs to this orchestrator
        const { data: dep } = await supabaseAdmin
          .from("ai_deployments")
          .select("id, model_id, orchestrator_id")
          .eq("id", params.id)
          .maybeSingle();
        if (!dep) return jsonError("deployment not found", 404);
        if (dep.orchestrator_id && dep.orchestrator_id !== auth.orchestratorId) {
          return jsonError("deployment not assigned to this orchestrator", 403);
        }

        const patch: {
          status: string;
          container_id?: string;
          host?: string;
          error?: string;
          stopped_at?: string;
        } = { status: body.status };
        if (body.container_id) patch.container_id = body.container_id;
        if (body.host) patch.host = body.host;
        if (body.error) patch.error = body.error;
        if (body.status === "stopped" || body.status === "failed") patch.stopped_at = new Date().toISOString();

        const { error } = await supabaseAdmin.from("ai_deployments").update(patch).eq("id", params.id);
        if (error) return jsonError(error.message, 500);

        // Mirror status onto model
        const modelStatus =
          body.status === "running" ? "running" :
          body.status === "failed" ? "failed" :
          body.status === "stopped" ? "stopped" :
          "building";
        await supabaseAdmin.from("ai_models").update({ status: modelStatus }).eq("id", dep.model_id);

        await supabaseAdmin.from("ai_deployment_events").insert({
          deployment_id: params.id,
          level: body.status === "failed" ? "error" : "info",
          message: `Status → ${body.status}${body.error ? `: ${body.error}` : ""}`,
        });

        return json({ ok: true });
      },
    },
  },
});
