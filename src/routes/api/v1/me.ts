import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET /api/v1/me — versioned alias of the account endpoint.
export const Route = createFileRoute("/api/v1/me")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { safeHandler, forwardToCanonical } = await import("@/lib/api-files.server");
        return safeHandler(({ request: req }) => forwardToCanonical(req, "/api/public/v1/me"))({ request });
      },
    },
  },
});
