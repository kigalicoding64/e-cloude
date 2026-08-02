import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";

// Per-model gateway. Client calls with X-API-Key: eck_live_...
// Body is forwarded to the running deployment's orchestrator at /v1/chat/completions.
// Applies rate limiting (per-minute requests) and monthly token quota.
export const Route = createFileRoute("/api/public/v1/chat/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        const started = Date.now();
        const key = request.headers.get("x-api-key") ?? "";
        if (!key.startsWith("eck_")) {
          return json({ error: "missing X-API-Key" }, 401);
        }
        const { sha256Hex } = await import("@/lib/hash");
        const key_hash = await sha256Hex(key);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Resolve gateway key
        const { data: gkey } = await supabaseAdmin
          .from("ai_gateway_keys")
          .select("id, owner_id, model_id, rate_limit_per_min, quota_tokens_month, tokens_used_month, quota_reset_at, revoked_at")
          .eq("key_hash", key_hash)
          .maybeSingle();
        if (!gkey || gkey.revoked_at) return json({ error: "invalid api key" }, 401);

        // 2. Resolve model by slug and check scope
        const { data: model } = await supabaseAdmin
          .from("ai_models")
          .select("id, slug, endpoint_path, owner_id")
          .eq("slug", params.slug)
          .maybeSingle();
        if (!model) return json({ error: "model not found" }, 404);
        if (gkey.model_id && gkey.model_id !== model.id) {
          return json({ error: "api key not scoped to this model" }, 403);
        }

        // 3. Monthly quota (auto-reset)
        let tokensUsed = gkey.tokens_used_month ?? 0;
        let quotaReset = gkey.quota_reset_at;
        if (quotaReset && new Date(quotaReset) < new Date()) {
          const next = new Date();
          next.setUTCMonth(next.getUTCMonth() + 1);
          next.setUTCDate(1); next.setUTCHours(0, 0, 0, 0);
          await supabaseAdmin.from("ai_gateway_keys").update({
            tokens_used_month: 0,
            quota_reset_at: next.toISOString(),
          }).eq("id", gkey.id);
          tokensUsed = 0;
        }
        if (tokensUsed >= gkey.quota_tokens_month) {
          await logReq(supabaseAdmin, gkey.id, model.id, null, 0, 0, Date.now() - started, 429, "quota exceeded");
          return json({ error: "monthly token quota exceeded" }, 429);
        }

        // 4. Rate limit — count requests in last 60 seconds
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count } = await supabaseAdmin
          .from("ai_gateway_requests")
          .select("id", { count: "exact", head: true })
          .eq("key_id", gkey.id)
          .gte("created_at", since);
        if ((count ?? 0) >= gkey.rate_limit_per_min) {
          await logReq(supabaseAdmin, gkey.id, model.id, null, 0, 0, Date.now() - started, 429, "rate limit");
          return new Response(JSON.stringify({ error: "rate limit exceeded" }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
              "X-RateLimit-Limit": String(gkey.rate_limit_per_min),
              "X-RateLimit-Remaining": "0",
              ...CORS_HEADERS,
            },
          });
        }

        // 5. Find a running deployment + orchestrator
        const { data: dep } = await supabaseAdmin
          .from("ai_deployments")
          .select("id, orchestrator_id, ai_orchestrators(base_url, status)")
          .eq("model_id", model.id)
          .eq("status", "running")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle() as { data: { id: string; orchestrator_id: string | null; ai_orchestrators: { base_url: string; status: string } | null } | null };

        if (!dep || !dep.ai_orchestrators?.base_url) {
          await logReq(supabaseAdmin, gkey.id, model.id, dep?.id ?? null, 0, 0, Date.now() - started, 503, "no running deployment");
          return json({ error: "no running deployment for this model" }, 503);
        }

        // 6. Forward to orchestrator (OpenAI-compatible)
        const bodyText = await request.text();
        const upstream = `${dep.ai_orchestrators.base_url.replace(/\/+$/, "")}/v1/chat/completions`;
        let resp: Response;
        try {
          resp = await fetch(upstream, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyText,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "upstream error";
          await logReq(supabaseAdmin, gkey.id, model.id, dep.id, 0, 0, Date.now() - started, 502, msg);
          return json({ error: `upstream unreachable: ${msg}` }, 502);
        }

        const respText = await resp.text();
        let tokens_in = 0, tokens_out = 0;
        try {
          const parsed = JSON.parse(respText);
          tokens_in = parsed?.usage?.prompt_tokens ?? 0;
          tokens_out = parsed?.usage?.completion_tokens ?? 0;
        } catch {}
        const total = tokens_in + tokens_out;

        // 7. Log & increment quota
        await logReq(supabaseAdmin, gkey.id, model.id, dep.id, tokens_in, tokens_out, Date.now() - started, resp.status);
        if (total > 0) {
          await supabaseAdmin.from("ai_gateway_keys").update({
            tokens_used_month: tokensUsed + total,
            last_used_at: new Date().toISOString(),
          }).eq("id", gkey.id);
          const { data: cur } = await supabaseAdmin.from("ai_deployments").select("total_tokens").eq("id", dep.id).single();
          await supabaseAdmin.from("ai_deployments").update({
            total_tokens: Number(cur?.total_tokens ?? 0) + total,
          }).eq("id", dep.id);
        } else {
          await supabaseAdmin.from("ai_gateway_keys").update({
            last_used_at: new Date().toISOString(),
          }).eq("id", gkey.id);
        }

        return new Response(respText, {
          status: resp.status,
          headers: {
            "Content-Type": resp.headers.get("content-type") ?? "application/json",
            "X-RateLimit-Limit": String(gkey.rate_limit_per_min),
            "X-RateLimit-Remaining": String(Math.max(0, gkey.rate_limit_per_min - (count ?? 0) - 1)),
            "X-Quota-Remaining": String(Math.max(0, gkey.quota_tokens_month - tokensUsed - total)),
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logReq(
  db: any,
  key_id: string,
  model_id: string,
  deployment_id: string | null,
  tokens_in: number,
  tokens_out: number,
  latency_ms: number,
  status: number,
  error?: string,
) {
  await db.from("ai_gateway_requests").insert({
    key_id, model_id, deployment_id, tokens_in, tokens_out, latency_ms, status, error: error ?? null,
  });
}

