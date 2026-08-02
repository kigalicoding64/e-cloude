// Shared CORS headers for the public REST API so third-party apps
// (browser SDKs, other origins) can call E-Cloud endpoints.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-API-Key, X-Requested-With, Accept, Origin, Content-Length",
  "Access-Control-Expose-Headers":
    "X-RateLimit-Limit, X-RateLimit-Remaining, X-Quota-Remaining, Retry-After",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Clamp a requested signed-URL lifetime to a safe range (seconds). */
export const SIGNED_URL_MIN_SECONDS = 30;
export const SIGNED_URL_MAX_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const SIGNED_URL_DEFAULT_SECONDS = 300;

export function clampExpiresIn(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return SIGNED_URL_DEFAULT_SECONDS;
  return Math.max(SIGNED_URL_MIN_SECONDS, Math.min(SIGNED_URL_MAX_SECONDS, Math.floor(n)));
}

export function expiryInfo(expiresIn: number) {
  return {
    expires_in: expiresIn,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}
