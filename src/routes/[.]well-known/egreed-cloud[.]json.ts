import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, corsPreflight } from "@/lib/cors";
import { API_SCOPES, SCOPE_DESCRIPTIONS } from "@/lib/api-errors";

// GET /.well-known/egreed-cloud.json -> machine-readable service manifest.
export const Route = createFileRoute("/.well-known/egreed-cloud.json")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        void request; const base = PUBLIC_BASE_URL;
        return new Response(
          JSON.stringify(
            {
              service: "EGREED Cloud",
              short_name: "E-Cloud",
              description:
                "Cloud storage platform with an API-first backend for third-party apps and AI agents.",
              vendor: "EGREED Tech",
              api: {
                current_version: "v1",
                versions: [
                  { version: "v1", status: "stable", base_url: `${base}/api/public/v1` },
                ],
                base_url: `${base}/api/public/v1`,
                auth: { scheme: "api_key", header: "X-API-Key", alternative: "Authorization: Bearer" },
                scopes: API_SCOPES.map((s) => ({ name: s, description: SCOPE_DESCRIPTIONS[s] })),
              },
              discovery: {
                openapi_json: `${base}/openapi.json`,
                openapi_yaml: `${base}/openapi.yaml`,
                discovery_document: `${base}/api/public/v1`,
                llms_txt: `${base}/llms.txt`,
                postman_collection: `${base}/postman.json`,
                insomnia_collection: `${base}/insomnia.json`,
                bruno_collection: `${base}/bruno.json`,
                sitemap: `${base}/sitemap.xml`,
              },
              documentation: {
                interactive: `${base}/docs`,
                reference: `${base}/developer-docs`,
                guides: `${base}/developer`,
                playground: `${base}/playground`,
                ai_integrations: `${base}/ai`,
                developer_hub: `${base}/developers`,
              },
              health: {
                liveness: `${base}/api/public/v1/live`,
                readiness: `${base}/api/public/v1/ready`,
                health: `${base}/api/public/v1/health`,
                metrics: `${base}/api/public/v1/metrics`,
              },
              cors: { enabled: true, allowed_origins: ["*"], preflight: true },
            },
            null,
            2,
          ),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=600",
              ...CORS_HEADERS,
            },
          },
        );
      },
    },
  },
});
