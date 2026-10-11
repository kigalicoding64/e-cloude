import { createFileRoute } from "@tanstack/react-router";

/**
 * OAuth 2.1 token endpoint.
 *
 * Grants: authorization_code (with PKCE), refresh_token (rotating),
 * client_credentials (machine-to-machine, no user context).
 */
export const Route = createFileRoute("/api/public/oauth/token")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/oauth.server");
        return corsPreflight();
      },
      POST: async ({ request }) => {
        const { handleToken } = await import("@/lib/oauth-handlers.server");
        return handleToken(request);
      },
    },
  },
});
