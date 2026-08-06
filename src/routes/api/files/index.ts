import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET /api/files — alias of the canonical file listing.
export const Route = createFileRoute("/api/files/")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { safeHandler, handleListFiles } = await import("@/lib/api-files.server");
        return safeHandler(handleListFiles)({ request });
      },
    },
  },
});
