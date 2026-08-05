import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";
import { buildBrunoCollection } from "@/lib/collections";

// GET /bruno.json -> importable Bruno collection
export const Route = createFileRoute("/bruno.json")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const base = new URL(request.url).origin;
        return new Response(JSON.stringify(buildBrunoCollection(base), null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="egreed-cloud.bruno.json"',
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});
