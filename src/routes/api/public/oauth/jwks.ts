import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/oauth/jwks")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { corsPreflight } = await import("@/lib/oauth.server");
        return corsPreflight();
      },
      GET: async () => {
        const { publicJwks, jsonResponse } = await import("@/lib/oauth.server");
        const jwks = await publicJwks();
        return jsonResponse(jwks, 200, { "cache-control": "public, max-age=600" });
      },
    },
  },
});
