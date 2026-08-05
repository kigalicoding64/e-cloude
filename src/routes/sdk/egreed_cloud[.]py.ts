import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, corsPreflight } from "@/lib/cors";
import { PY_SDK } from "@/lib/sdk-sources";

// GET /sdk/egreed_cloud.py -> downloadable Python SDK
export const Route = createFileRoute("/sdk/egreed_cloud.py")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () =>
        new Response(PY_SDK, {
          status: 200,
          headers: {
            "Content-Type": "text/x-python; charset=utf-8",
            "Content-Disposition": 'attachment; filename="egreed_cloud.py"',
            ...CORS_HEADERS,
          },
        }),
    },
  },
});
