import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET/POST /api/v1/folders — versioned alias of the folders endpoint.
export const Route = createFileRoute("/api/v1/folders/")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { safeHandler, forwardToCanonical } = await import("@/lib/api-files.server");
        return safeHandler(({ request: req }) => forwardToCanonical(req, "/api/public/v1/folders"))({ request });
      },
      POST: async ({ request }) => {
        const { safeHandler, forwardToCanonical } = await import("@/lib/api-files.server");
        return safeHandler(({ request: req }) => forwardToCanonical(req, "/api/public/v1/folders"))({ request });
      },
    },
  },
});
