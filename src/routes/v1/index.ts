import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET /v1 — discovery document, alias of /api/public/v1/
export const Route = createFileRoute("/v1/")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { safeHandler, forwardToCanonical } = await import("@/lib/api-files.server");
        return safeHandler(({ request: req }) => forwardToCanonical(req, "/api/public/v1/"))({ request });
      },
    },
  },
});
