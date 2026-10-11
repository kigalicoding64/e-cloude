import { createFileRoute } from "@tanstack/react-router";

/**
 * Standard discovery location. OIDC client libraries fetch
 * `/.well-known/openid-configuration` automatically, so it mirrors the
 * document served under /api/public/oauth.
 */
export const Route = createFileRoute("/.well-known/openid-configuration")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/oauth.server");
        return corsPreflight();
      },
      GET: async ({ request }) => {
        const { issuerFromRequest, jsonResponse } = await import("@/lib/oauth.server");
        const { API_SCOPES, OAUTH_SCOPES } = await import("@/lib/egreed");
        const issuer = issuerFromRequest(request);
        return jsonResponse({
          issuer,
          authorization_endpoint: `${issuer}/oauth/authorize`,
          token_endpoint: `${issuer}/api/public/oauth/token`,
          userinfo_endpoint: `${issuer}/api/public/oauth/userinfo`,
          jwks_uri: `${issuer}/api/public/oauth/jwks`,
          introspection_endpoint: `${issuer}/api/public/oauth/introspect`,
          revocation_endpoint: `${issuer}/api/public/oauth/revoke`,
          scopes_supported: [...OAUTH_SCOPES, ...API_SCOPES],
          response_types_supported: ["code"],
          response_modes_supported: ["query"],
          grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: [
            "client_secret_basic",
            "client_secret_post",
            "none",
          ],
          code_challenge_methods_supported: ["S256", "plain"],
          service_documentation: `${issuer}/docs`,
        });
      },
    },
  },
});
