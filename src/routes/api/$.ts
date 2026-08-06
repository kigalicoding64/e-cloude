import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// Catch-all for any unmatched /api/* path so API clients never receive an
// HTML page. More specific API routes always win over this splat.
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { handleUnknownApiPath } = await import("@/lib/api-files.server");
        return handleUnknownApiPath(request);
      },
      POST: async ({ request }) => {
        const { handleUnknownApiPath } = await import("@/lib/api-files.server");
        return handleUnknownApiPath(request);
      },
      PUT: async ({ request }) => {
        const { handleUnknownApiPath } = await import("@/lib/api-files.server");
        return handleUnknownApiPath(request);
      },
      PATCH: async ({ request }) => {
        const { handleUnknownApiPath } = await import("@/lib/api-files.server");
        return handleUnknownApiPath(request);
      },
      DELETE: async ({ request }) => {
        const { handleUnknownApiPath } = await import("@/lib/api-files.server");
        return handleUnknownApiPath(request);
      },
    },
  },
});
