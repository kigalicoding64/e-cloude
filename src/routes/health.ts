import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET /health -> top-level alias of the EGREED Cloud health probe (JSON only).
export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () => {
        const { safeHandler, handleHealth } = await import("@/lib/api-files.server");
        return safeHandler(() => handleHealth())({ request: new Request("http://local/health") });
      },
    },
  },
});
