import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";
import { buildOpenApiSpec } from "@/lib/openapi";

// GET /api/public/v1/openapi.json -> OpenAPI 3.1 spec
export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const base = new URL(request.url).origin;
        return new Response(JSON.stringify(buildOpenApiSpec(base), null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      },
    },
  },
});
