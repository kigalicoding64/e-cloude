import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";
import { buildOpenApiSpec } from "@/lib/openapi";
import { toYaml } from "@/lib/yaml";

// GET /openapi.yaml -> YAML rendering of the OpenAPI 3.1 document.
export const Route = createFileRoute("/openapi.yaml")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        void request; const base = PUBLIC_BASE_URL;
        const yaml = `# EGREED Cloud API — OpenAPI 3.1\n${toYaml(buildOpenApiSpec(base))}\n`;
        return new Response(yaml, {
          status: 200,
          headers: {
            "Content-Type": "application/yaml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});
