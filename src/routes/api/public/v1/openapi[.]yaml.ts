import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";
import { buildOpenApiSpec } from "@/lib/openapi";
import { toYaml } from "@/lib/yaml";

// GET /api/public/v1/openapi.yaml
export const Route = createFileRoute("/api/public/v1/openapi.yaml")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        void request; const base = PUBLIC_BASE_URL;
        return new Response(`${toYaml(buildOpenApiSpec(base))}\n`, {
          status: 200,
          headers: { "Content-Type": "application/yaml; charset=utf-8", ...CORS_HEADERS },
        });
      },
    },
  },
});
