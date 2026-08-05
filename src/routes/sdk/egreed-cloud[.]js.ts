import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, corsPreflight } from "@/lib/cors";
import { JS_SDK } from "@/lib/sdk-sources";

// GET /sdk/egreed-cloud.js -> downloadable JavaScript/TypeScript SDK
export const Route = createFileRoute("/sdk/egreed-cloud.js")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () =>
        new Response(JS_SDK, {
          status: 200,
          headers: {
            "Content-Type": "text/javascript; charset=utf-8",
            "Content-Disposition": 'attachment; filename="egreed-cloud.js"',
            ...CORS_HEADERS,
          },
        }),
    },
  },
});
