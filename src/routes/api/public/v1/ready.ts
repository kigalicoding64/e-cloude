import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, corsPreflight } from "@/lib/cors";

// GET /api/public/v1/ready -> readiness probe: database + storage reachable.
export const Route = createFileRoute("/api/public/v1/ready")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () => {
        const checks: Record<string, string> = { api: "ok", database: "unknown", storage: "unknown" };
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("profiles").select("id").limit(1);
          checks.database = error ? "error" : "ok";
          const { error: bucketErr } = await supabaseAdmin.storage.from("user-files").list("", { limit: 1 });
          checks.storage = bucketErr ? "error" : "ok";
        } catch {
          if (checks.database === "unknown") checks.database = "error";
          if (checks.storage === "unknown") checks.storage = "error";
        }
        const ready = Object.values(checks).every((v) => v === "ok");
        return new Response(
          JSON.stringify({ status: ready ? "ready" : "not_ready", checks, time: new Date().toISOString() }),
          {
            status: ready ? 200 : 503,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS },
          },
        );
      },
    },
  },
});
