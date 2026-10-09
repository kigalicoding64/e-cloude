import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";
import { buildInsomniaCollection } from "@/lib/collections";

// GET /insomnia.json -> importable Insomnia collection
export const Route = createFileRoute("/insomnia.json")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        void request; const base = PUBLIC_BASE_URL;
        return new Response(JSON.stringify(buildInsomniaCollection(base), null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="egreed-cloud.insomnia.json"',
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});
