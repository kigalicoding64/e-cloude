import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";

// GET /api/public/v1/health -> unauthenticated liveness + database reachability.
export const Route = createFileRoute("/api/public/v1/health")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () => {
        let database = "unknown";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("profiles").select("id").limit(1);
          database = error ? "error" : "ok";
        } catch {
          database = "error";
        }
        const ok = database === "ok";
        return new Response(
          JSON.stringify({
            status: ok ? "ok" : "degraded",
            api: "ok",
            database,
            time: new Date().toISOString(),
          }),
          {
            status: ok ? 200 : 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS },
          },
        );
      },
    },
  },
});
