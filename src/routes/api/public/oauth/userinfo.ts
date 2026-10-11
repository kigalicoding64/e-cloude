import { createFileRoute } from "@tanstack/react-router";

/** OIDC UserInfo endpoint — requires a Bearer access token with `openid`. */
export const Route = createFileRoute("/api/public/oauth/userinfo")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/oauth.server");
        return corsPreflight();
      },
      GET: async ({ request }) => {
        const { handleUserinfo } = await import("@/lib/oauth-handlers.server");
        return handleUserinfo(request);
      },
      POST: async ({ request }) => {
        const { handleUserinfo } = await import("@/lib/oauth-handlers.server");
        return handleUserinfo(request);
      },
    },
  },
});
