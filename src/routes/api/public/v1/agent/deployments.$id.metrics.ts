import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// Agent posts GPU/memory/throughput samples. Accepts single or batch.
export const Route = createFileRoute("/api/public/v1/agent/deployments/$id/metrics")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        const { authenticateAgent, json, jsonError } = await import("@/lib/agent-auth.server");
        const auth = await authenticateAgent(request);
        if (!auth) return jsonError("Invalid agent token", 401);
        type Sample = {
          gpu_util?: number;
          memory_used_mb?: number;
          vram_used_mb?: number;
          tokens_per_sec?: number;
          measured_at?: string;
        };
        const body = await request.json().catch(() => null) as (Sample & { samples?: Sample[] }) | null;
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

        const samples = (body.samples ?? [body]).filter(Boolean).map((s) => ({
          deployment_id: params.id,
          gpu_util: s.gpu_util ?? null,
          memory_used_mb: s.memory_used_mb ?? null,
          vram_used_mb: s.vram_used_mb ?? null,
          tokens_per_sec: s.tokens_per_sec ?? null,
          measured_at: s.measured_at ?? new Date().toISOString(),
        }));
        if (samples.length === 0) return jsonError("no samples", 400);
        const { error } = await supabaseAdmin.from("ai_metrics").insert(samples);
        if (error) return jsonError(error.message, 500);

        // Mirror latest onto deployment for quick reads
        const last = samples[samples.length - 1];
        await supabaseAdmin.from("ai_deployments").update({
          gpu_util: last.gpu_util ?? undefined,
          memory_used_mb: last.memory_used_mb ?? undefined,
          tokens_per_sec: last.tokens_per_sec ?? undefined,
        }).eq("id", params.id);

        return json({ ok: true, ingested: samples.length });
      },
    },
  },
});
