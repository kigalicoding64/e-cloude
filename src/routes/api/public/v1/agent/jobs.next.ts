import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// Agent polls this to fetch the next pending deployment job.
// Assigns unassigned jobs to this orchestrator, or picks up ones already assigned to it.
export const Route = createFileRoute("/api/public/v1/agent/jobs/next")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { authenticateAgent, json, jsonError } = await import("@/lib/agent-auth.server");
        const auth = await authenticateAgent(request);
        if (!auth) return jsonError("Invalid agent token", 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Grab oldest pending job assigned to this orchestrator OR unassigned
        const { data: dep } = await supabaseAdmin
          .from("ai_deployments")
          .select("id, model_id, orchestrator_id, version_id, status")
          .eq("status", "pending")
          .or(`orchestrator_id.eq.${auth.orchestratorId},orchestrator_id.is.null`)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!dep) return json({ job: null });

        // Claim it
        const { error: upErr } = await supabaseAdmin
          .from("ai_deployments")
          .update({ orchestrator_id: auth.orchestratorId, status: "building", started_at: new Date().toISOString() })
          .eq("id", dep.id)
          .eq("status", "pending"); // guard vs. race
        if (upErr) return jsonError(upErr.message, 500);

        const { data: model } = await supabaseAdmin
          .from("ai_models")
          .select("id, name, slug, source_repo, source_ref, framework, task, gpu_type, memory_mb, endpoint_path")
          .eq("id", dep.model_id)
          .single();

        let version = null;
        if (dep.version_id) {
          const { data } = await supabaseAdmin
            .from("ai_model_versions")
            .select("id, git_ref, commit_sha, source_repo, deployment_config")
            .eq("id", dep.version_id)
            .single();
          version = data;
        }

        await supabaseAdmin.from("ai_deployment_events").insert({
          deployment_id: dep.id,
          level: "info",
          message: `Job claimed by orchestrator ${auth.orchestratorId}`,
        });

        return json({
          job: {
            deployment_id: dep.id,
            model,
            version,
            repo: version?.source_repo ?? model?.source_repo,
            ref: version?.git_ref ?? model?.source_ref ?? "main",
            deployment_config: version?.deployment_config ?? {},
          },
        });
      },
    },
  },
});
