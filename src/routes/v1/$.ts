import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

/**
 * Un-prefixed alias: /v1/* -> /api/public/v1/*
 *
 * Many third-party integrations are configured with a base URL of
 * https://cloud.egreedtech.org/v1 . Without this alias those callers received
 * the SPA HTML shell / a 404. Every method is forwarded to the canonical
 * public API route so the contract stays identical.
 */
const forward = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  const { safeHandler, forwardToCanonical } = await import("@/lib/api-files.server");
  const splat = params._splat ?? "";
  const canonical = `/api/public/v1/${splat}`.replace(/\/+$/, splat ? "" : "/");
  return safeHandler(({ request: req }) => forwardToCanonical(req, canonical))({ request });
};

export const Route = createFileRoute("/v1/$")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: forward,
      POST: forward,
      PUT: forward,
      PATCH: forward,
      DELETE: forward,
    },
  },
});
