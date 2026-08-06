import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET/DELETE /api/v1/files/:id
export const Route = createFileRoute("/api/v1/files/$id")({
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
