import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, corsPreflight } from "@/lib/cors";

// GET /api/public/v1/metrics -> aggregate, non-identifying service metrics.
export const Route = createFileRoute("/api/public/v1/metrics")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () => {
        const started = Date.now();
        let files = 0;
        let accounts = 0;
        let apiRequests24h = 0;
        let database = "ok";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const [f, a, r] = await Promise.all([
            supabaseAdmin.from("files").select("id", { count: "exact", head: true }).eq("is_trashed", false),
            supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
            supabaseAdmin
              .from("ai_gateway_requests")
              .select("id", { count: "exact", head: true })
              .gte("created_at", since),
          ]);
          files = f.count ?? 0;
          accounts = a.count ?? 0;
          apiRequests24h = r.count ?? 0;
        } catch {
          database = "error";
        }
        return new Response(
          JSON.stringify({
            status: database === "ok" ? "ok" : "degraded",
            collected_at: new Date().toISOString(),
            collection_ms: Date.now() - started,
            metrics: {
              files_total: files,
              accounts_total: accounts,
              ai_gateway_requests_24h: apiRequests24h,
            },
          }),
          {
            status: database === "ok" ? 200 : 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS },
          },
        );
      },
    },
  },
});
