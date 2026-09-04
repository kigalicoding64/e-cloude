import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";

// GET /api/public/v1/diagnostics/env -> presence-only report of the backend
// bindings this runtime can see. Never returns any secret value.
export const Route = createFileRoute("/api/public/v1/diagnostics/env")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () => {
        const { getServerSupabaseConfig, checkSupabaseReachable } = await import(
          "@/lib/api-env.server"
        );
        const cfg = getServerSupabaseConfig();
        return new Response(
          JSON.stringify({
            runtime: {
              supabase_url: Boolean(process.env["SUPABASE_URL"]),
              supabase_publishable_key: Boolean(process.env["SUPABASE_PUBLISHABLE_KEY"]),
              supabase_service_role_key: cfg.hasServiceRole,
            },
            build_fallback: {
              supabase_url: Boolean(import.meta.env.VITE_SUPABASE_URL),
              supabase_publishable_key: Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
            },
            effective_config_source: cfg.source,
            supabase_reachable: await checkSupabaseReachable(),
            time: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS },
          },
        );
      },
    },
  },
});
