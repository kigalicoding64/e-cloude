import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET/DELETE /api/files/:id — alias of the canonical single-file endpoints.
export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const { safeHandler, handleGetFile } = await import("@/lib/api-files.server");
        return safeHandler(handleGetFile)({ request, params });
      },
      DELETE: async ({ request, params }) => {
        const { safeHandler, handleDeleteFile } = await import("@/lib/api-files.server");
        return safeHandler(handleDeleteFile)({ request, params });
      },
    },
  },
});
