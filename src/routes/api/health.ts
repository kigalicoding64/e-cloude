import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET /api/health
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { safeHandler, handleHealth } = await import("@/lib/api-files.server");
        return safeHandler(() => handleHealth())({ request });
      },
    },
  },
});
