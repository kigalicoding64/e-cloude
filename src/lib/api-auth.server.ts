// Resolves an API key (X-API-Key: eck_live_...) to its owner user_id + scopes,
// enforces fine-grained scopes, and implements idempotency-key handling.
import { sha256Hex } from "@/lib/hash";
import { CORS_HEADERS } from "@/lib/cors";
import {
  type ApiErrorCode,
  newRequestId,
  type ApiScope,
  buildErrorBody,
  normalizeScopes,
  hasScope,
  statusForCode,
} from "@/lib/api-errors";

export type ApiCaller = { userId: string; keyId: string; scopes: ApiScope[] };

export async function authenticateApiKey(request: Request): Promise<ApiCaller | null> {
  const key =
    request.headers.get("x-api-key") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!key || !key.startsWith("eck_")) return null;
  const key_hash = await sha256Hex(key);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, is_active, scopes")
    .eq("key_hash", key_hash)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return {
    userId: data.user_id,
    keyId: data.id,
    scopes: normalizeScopes((data as { scopes?: unknown }).scopes),
  };
}

export function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...(extraHeaders ?? {}) },
  });
}

/** Consistent error envelope. Code is derived from the status when omitted. */
export function jsonError(
  message: string,
  status: number,
  code?: ApiErrorCode,
  details?: unknown,
): Response {
  const requestId = newRequestId();
  return json(buildErrorBody(message, status, code, details, requestId), status, {
    "X-Request-Id": requestId,
  });
}

export function apiError(code: ApiErrorCode, message: string, details?: unknown): Response {
  const status = statusForCode(code);
  const requestId = newRequestId();
  return json(buildErrorBody(message, status, code, details, requestId), status, {
    "X-Request-Id": requestId,
  });
}

/**
 * Authenticate + authorize in one step.
 * Returns either the caller or a ready-to-return error Response.
 */
export async function authorize(
  request: Request,
  requiredScope?: ApiScope,
): Promise<{ caller: ApiCaller; error?: undefined } | { caller?: undefined; error: Response }> {
  const provided =
    request.headers.get("x-api-key") ?? request.headers.get("authorization");
  if (!provided) {
    return {
      error: apiError("missing_api_key", "Missing API key. Send it in the X-API-Key header."),
    };
  }
  const caller = await authenticateApiKey(request);
  if (!caller) {
    return { error: apiError("invalid_api_key", "Invalid, revoked or inactive API key.") };
  }
  if (requiredScope && !hasScope(caller.scopes, requiredScope)) {
    return {
      error: apiError(
        "insufficient_scope",
        `This API key is missing the '${requiredScope}' scope.`,
        { required_scope: requiredScope, granted_scopes: caller.scopes },
      ),
    };
  }
  return { caller };
}

/* ------------------------------------------------------------------ */
/* Idempotency                                                         */
/* ------------------------------------------------------------------ */

export type IdempotencyHandle = {
  key: string;
  endpoint: string;
  userId: string;
};

/**
 * Look at the Idempotency-Key header. Returns:
 *  - { replay } when a previous identical request already completed (or is in flight)
 *  - { handle } when the caller should proceed and later call finishIdempotency
 *  - {} when no idempotency key was supplied
 */
export async function beginIdempotency(
  request: Request,
  caller: ApiCaller,
  endpoint: string,
  fingerprint?: string,
): Promise<{ replay?: Response; handle?: IdempotencyHandle }> {
  const key = (request.headers.get("idempotency-key") ?? "").trim().slice(0, 200);
  if (!key) return {};

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("api_idempotency_records").insert({
    user_id: caller.userId,
    api_key_id: caller.keyId,
    idempotency_key: key,
    endpoint,
    request_fingerprint: fingerprint ?? null,
    state: "in_progress",
  });

  if (!error) return { handle: { key, endpoint, userId: caller.userId } };

  // Unique violation -> a record already exists for this key.
  const { data: existing } = await supabaseAdmin
    .from("api_idempotency_records")
    .select("state, status, response, request_fingerprint")
    .eq("user_id", caller.userId)
    .eq("endpoint", endpoint)
    .eq("idempotency_key", key)
    .maybeSingle();

  if (!existing) {
    // Race: treat as retryable.
    return {
      replay: apiError("idempotency_in_progress", "A request with this Idempotency-Key is in flight. Retry shortly."),
    };
  }
  if (fingerprint && existing.request_fingerprint && existing.request_fingerprint !== fingerprint) {
    return {
      replay: apiError(
        "idempotency_key_reused",
        "This Idempotency-Key was already used with a different request payload.",
      ),
    };
  }
  if (existing.state === "completed" && existing.response) {
    return {
      replay: json(existing.response, existing.status ?? 200, { "Idempotent-Replayed": "true" }),
    };
  }
  return {
    replay: apiError("idempotency_in_progress", "A request with this Idempotency-Key is still being processed."),
  };
}

/** Store the final response so retries with the same key replay it. */
export async function finishIdempotency(
  handle: IdempotencyHandle | undefined,
  status: number,
  body: unknown,
): Promise<void> {
  if (!handle) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const completed = status >= 200 && status < 300;
  if (!completed) {
    // Failed attempts must not be replayed — free the key for a retry.
    await supabaseAdmin
      .from("api_idempotency_records")
      .delete()
      .eq("user_id", handle.userId)
      .eq("endpoint", handle.endpoint)
      .eq("idempotency_key", handle.key);
    return;
  }
  await supabaseAdmin
    .from("api_idempotency_records")
    .update({ state: "completed", status, response: body as never })
    .eq("user_id", handle.userId)
    .eq("endpoint", handle.endpoint)
    .eq("idempotency_key", handle.key);
}

/** Helper: run a handler under idempotency protection. */
export async function withIdempotency(
  request: Request,
  caller: ApiCaller,
  endpoint: string,
  fingerprint: string | undefined,
  run: () => Promise<{ status: number; body: unknown }>,
): Promise<Response> {
  const { replay, handle } = await beginIdempotency(request, caller, endpoint, fingerprint);
  if (replay) return replay;
  try {
    const { status, body } = await run();
    await finishIdempotency(handle, status, body);
    return json(body, status);
  } catch (e) {
    await finishIdempotency(handle, 500, null);
    throw e;
  }
}
