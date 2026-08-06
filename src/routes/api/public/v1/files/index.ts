import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// Canonical file listing. Implementation lives in @/lib/api-files.server so
// every alias path (/api/files, /api/v1/files) behaves identically.
export const Route = createFileRoute("/api/public/v1/files/")({
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
