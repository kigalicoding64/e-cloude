import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";
import { buildOpenApiSpec } from "@/lib/openapi";

// GET /openapi.json -> top-level alias of the OpenAPI 3.1 document.
export const Route = createFileRoute("/openapi.json")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const base = new URL(request.url).origin;
        return new Response(JSON.stringify(buildOpenApiSpec(base), null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});
