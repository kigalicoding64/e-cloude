import { createFileRoute } from "@tanstack/react-router";

/** RFC 7009 token revocation. Always returns 200 for valid client auth. */
export const Route = createFileRoute("/api/public/oauth/revoke")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/oauth.server");
        return corsPreflight();
      },
      POST: async ({ request }) => {
        const { handleRevoke } = await import("@/lib/oauth-handlers.server");
        return handleRevoke(request);
      },
    },
  },
});
