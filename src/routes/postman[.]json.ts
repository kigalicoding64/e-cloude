import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";
import { buildPostmanCollection } from "@/lib/collections";

// GET /postman.json -> importable Postman collection
export const Route = createFileRoute("/postman.json")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        void request; const base = PUBLIC_BASE_URL;
        return new Response(JSON.stringify(buildPostmanCollection(base), null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="egreed-cloud.postman_collection.json"',
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});
