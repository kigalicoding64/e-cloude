import { createFileRoute } from "@tanstack/react-router";

/** RFC 7662 token introspection. Requires client authentication. */
export const Route = createFileRoute("/api/public/oauth/introspect")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/oauth.server");
        return corsPreflight();
      },
      POST: async ({ request }) => {
        const { handleIntrospect } = await import("@/lib/oauth-handlers.server");
        return handleIntrospect(request);
      },
    },
  },
});
