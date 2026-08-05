import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, corsPreflight } from "@/lib/cors";

// GET /api/public/v1/live -> liveness probe (never touches the database).
export const Route = createFileRoute("/api/public/v1/live")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () =>
        new Response(JSON.stringify({ status: "ok", time: new Date().toISOString() }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS },
        }),
    },
  },
});
