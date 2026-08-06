import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// POST /api/upload — alias of POST /api/public/v1/files/upload.
export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const { safeHandler, forwardToCanonical } = await import("@/lib/api-files.server");
        return safeHandler(({ request: req }) =>
          forwardToCanonical(req, "/api/public/v1/files/upload"),
        )({ request });
      },
    },
  },
});
