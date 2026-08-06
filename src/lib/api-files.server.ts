// Canonical implementations for the EGREED Cloud file endpoints.
// Every alias route (/files, /api/files, /api/v1/files, /api/public/v1/files)
// delegates here so behaviour can never drift between paths.
//
// Guarantees:
//  - JSON only. HTML is never returned, even on an unexpected crash.
//  - Authentication + scope check before any data access.
//  - Ownership filtering: a client only ever sees rows for its key's owner.

import { CORS_HEADERS } from "@/lib/cors";
import { newRequestId, type ApiScope } from "@/lib/api-errors";
import { checkRateLimit, rateLimitHeaders } from "@/lib/api-rate-limit";
import { parseListParams, slugifyClientId, toApiFile, escapeLikeTerm, filePermissions } from "@/lib/api-files";

const SERVICE = "EGREED Cloud API";
const VERSION = "1.0";

function jsonResponse(body: unknown, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS, ...(headers ?? {}) },
  });
}

/**
 * Wrap any API handler so a thrown error becomes a JSON 500 instead of an
 * HTML error page. This is what made clients report `500` with unparsable bodies.
 */
export function safeHandler(
  handler: (args: { request: Request; params: Record<string, string> }) => Promise<Response>,
) {
  return async (args: { request: Request; params?: Record<string, string> }): Promise<Response> => {
    const requestId = newRequestId();
    try {
      const response = await handler({ request: args.request, params: args.params ?? {} });
      if (response.headers.get("X-Request-Id")) return response;
      const headers = new Headers(response.headers);
      headers.set("X-Request-Id", requestId);
      for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected server error";
      console.error(`[egreed-api] ${requestId} unhandled error:`, message);
      return jsonResponse(
        {
          success: false,
          error: "The request could not be completed. Please retry.",
          code: "INTERNAL_ERROR",
          status: 500,
          details: message,
          request_id: requestId,
          timestamp: new Date().toISOString(),
          documentation_url: "https://cloud.egreedtech.org/docs",
        },
        500,
        { "X-Request-Id": requestId },
      );
    }
  };
}

/* ------------------------------------------------------------------ */
/* Health                                                             */
/* ------------------------------------------------------------------ */

export async function handleHealth(): Promise<Response> {
  let database = "error";
  let storage = "error";
  let authentication = "error";

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ error: dbErr }, storageRes, { error: authErr }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").limit(1),
      supabaseAdmin.storage.from("user-files").list("", { limit: 1 }),
      supabaseAdmin.from("api_keys").select("id").limit(1),
    ]);
    database = dbErr ? "error" : "connected";
    storage = storageRes.error ? "error" : "connected";
    authentication = authErr ? "error" : "connected";
  } catch (e) {
    console.error("[egreed-api] health check failed:", e instanceof Error ? e.message : e);
  }

  const ok = database === "connected" && storage === "connected" && authentication === "connected";
  return jsonResponse(
    {
      status: ok ? "online" : "degraded",
      service: SERVICE,
      version: VERSION,
      api: "online",
      database,
      storage,
      authentication,
      timestamp: new Date().toISOString(),
    },
    ok ? 200 : 503,
  );
}

/* ------------------------------------------------------------------ */
/* Shared auth + client identity                                       */
/* ------------------------------------------------------------------ */

type Client = {
  userId: string;
  keyId: string;
  scopes: ApiScope[];
  clientId: string;
  clientName: string;
};

async function authorizeClient(
  request: Request,
  scope: ApiScope,
): Promise<{ client: Client; error?: undefined } | { client?: undefined; error: Response }> {
  const { authorize } = await import("@/lib/api-auth.server");
  const { caller, error } = await authorize(request, scope);
  if (error) return { error };

  const limit = checkRateLimit(caller.keyId);
  if (!limit.allowed) {
    return {
      error: jsonResponse(
        {
          success: false,
          error: "Rate limit exceeded. Slow down and retry.",
          code: "RATE_LIMITED",
          status: 429,
          retry_after: limit.retryAfterSeconds,
          timestamp: new Date().toISOString(),
        },
        429,
        rateLimitHeaders(limit),
      ),
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: key } = await supabaseAdmin
    .from("api_keys")
    .select("name")
    .eq("id", caller.keyId)
    .maybeSingle();
  const clientName = key?.name ?? "api-client";
  return {
    client: {
      userId: caller.userId,
      keyId: caller.keyId,
      scopes: caller.scopes,
      clientId: slugifyClientId(clientName, caller.keyId),
      clientName,
    },
  };
}

/* ------------------------------------------------------------------ */
/* GET /files                                                          */
/* ------------------------------------------------------------------ */

export async function handleListFiles({ request }: { request: Request }): Promise<Response> {
  const { client, error } = await authorizeClient(request, "read");
  if (error) return error;

  const params = parseListParams(new URL(request.url).searchParams);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin
    .from("files")
    .select(
      "id,user_id,name,size,mime_type,folder_id,storage_path,is_favorite,is_trashed,password_hash,pin_hash,created_at,updated_at",
      { count: "exact" },
    )
    // Ownership enforcement — a client can only ever see its owner's rows.
    .eq("user_id", client.userId)
    .order("created_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (!params.includeTrashed) query = query.eq("is_trashed", false);
  if (params.folder) query = query.eq("folder_id", params.folder);
  if (params.search) query = query.ilike("name", `%${escapeLikeTerm(params.search)}%`);

  const { data, count, error: dbErr } = await query;
  if (dbErr) {
    console.error("[egreed-api] GET /files database error:", dbErr.message);
    return jsonResponse(
      {
        success: false,
        error: "Database query failed",
        code: "DATABASE_ERROR",
        status: 500,
        details: dbErr.message,
        timestamp: new Date().toISOString(),
      },
      500,
    );
  }

  const rows = data ?? [];
  const files = rows.map((row) =>
    toApiFile(row, { ownerId: client.userId, clientId: client.clientId, scopes: client.scopes }),
  );
  const total = count ?? files.length;

  return jsonResponse(
    {
      success: true,
      client: client.clientName,
      client_id: client.clientId,
      owner_id: client.userId,
      permissions: filePermissions(client.scopes),
      files,
      // Legacy top-level pagination fields kept for existing integrations.
      limit: params.limit,
      offset: params.offset,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        page: Math.floor(params.offset / params.limit) + 1,
        pages: params.limit ? Math.max(1, Math.ceil(total / params.limit)) : 1,
        has_more: params.offset + files.length < total,
      },
      ...(files.length === 0 ? { message: "No files assigned" } : {}),
    },
    200,
  );
}

/* ------------------------------------------------------------------ */
/* GET /files/:id                                                      */
/* ------------------------------------------------------------------ */

export async function handleGetFile({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string>;
}): Promise<Response> {
  const { client, error } = await authorizeClient(request, "read");
  if (error) return error;

  const id = params["id"] ?? params["_splat"] ?? "";
  if (!id) {
    return jsonResponse(
      { success: false, error: "Missing file id", code: "VALIDATION_FAILED", status: 400, timestamp: new Date().toISOString() },
      400,
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error: dbErr } = await supabaseAdmin
    .from("files")
    .select(
      "id,user_id,name,size,mime_type,folder_id,storage_path,is_favorite,is_trashed,password_hash,pin_hash,created_at,updated_at",
    )
    .eq("id", id)
    .eq("user_id", client.userId)
    .maybeSingle();

  if (dbErr) {
    console.error("[egreed-api] GET /files/:id database error:", dbErr.message);
    return jsonResponse(
      { success: false, error: "Database query failed", code: "DATABASE_ERROR", status: 500, details: dbErr.message, timestamp: new Date().toISOString() },
      500,
    );
  }
  if (!data) {
    return jsonResponse(
      { success: false, error: "File not found or not assigned to this client", code: "NOT_FOUND", status: 404, timestamp: new Date().toISOString() },
      404,
    );
  }

  const file = toApiFile(data, {
    ownerId: client.userId,
    clientId: client.clientId,
    scopes: client.scopes,
  });

  const canDownload = client.scopes.includes("download") && !file.is_locked;
  let downloadUrl: string | null = null;
  if (canDownload) {
    const signed = await supabaseAdmin.storage
      .from("user-files")
      .createSignedUrl(data.storage_path, 300);
    downloadUrl = signed.data?.signedUrl ?? null;
  }

  return jsonResponse(
    {
      // Legacy flat fields first (pre-existing integrations read these),
      // then the documented envelope fields.
      ...file,
      success: true,
      client: client.clientName,
      client_id: client.clientId,
      file,
      download_url: downloadUrl,
      download_expires_in: downloadUrl ? 300 : null,
      download_expires_at: downloadUrl ? new Date(Date.now() + 300_000).toISOString() : null,
    },
    200,
  );
}

/* ------------------------------------------------------------------ */
/* DELETE /files/:id                                                   */
/* ------------------------------------------------------------------ */

export async function handleDeleteFile({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string>;
}): Promise<Response> {
  const { client, error } = await authorizeClient(request, "manage");
  if (error) return error;

  const id = params["id"] ?? "";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: file } = await supabaseAdmin
    .from("files")
    .select("id, size, storage_path")
    .eq("id", id)
    .eq("user_id", client.userId)
    .maybeSingle();
  if (!file) {
    return jsonResponse(
      { success: false, error: "File not found or not assigned to this client", code: "NOT_FOUND", status: 404, timestamp: new Date().toISOString() },
      404,
    );
  }

  await supabaseAdmin.storage.from("user-files").remove([file.storage_path]);
  const { error: dbErr } = await supabaseAdmin.from("files").delete().eq("id", file.id);
  if (dbErr) {
    return jsonResponse(
      { success: false, error: "Database delete failed", code: "DATABASE_ERROR", status: 500, details: dbErr.message, timestamp: new Date().toISOString() },
      500,
    );
  }

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("storage_used")
    .eq("id", client.userId)
    .maybeSingle();
  const newUsed = Math.max(0, Number(prof?.storage_used ?? 0) - Number(file.size));
  await supabaseAdmin.from("profiles").update({ storage_used: newUsed }).eq("id", client.userId);

  return jsonResponse({ success: true, deleted_id: file.id, ok: true }, 200);
}

/* ------------------------------------------------------------------ */
/* JSON 404 for any unmatched /api/* path                              */
/* ------------------------------------------------------------------ */

export function handleUnknownApiPath(request: Request): Response {
  const url = new URL(request.url);
  return jsonResponse(
    {
      success: false,
      error: `No API endpoint matches ${request.method} ${url.pathname}`,
      code: "NOT_FOUND",
      status: 404,
      hint: "Base URL is https://cloud.egreedtech.org/api/v1 — see /docs for the full endpoint list.",
      endpoints: [
        "GET /api/v1/health",
        "GET /api/v1/files",
        "GET /api/v1/files/:id",
        "DELETE /api/v1/files/:id",
        "POST /api/v1/upload",
        "GET /api/v1/me",
        "GET /api/v1/folders",
      ],
      request_id: newRequestId(),
      timestamp: new Date().toISOString(),
      documentation_url: "https://cloud.egreedtech.org/docs",
    },
    404,
  );
}

/* ------------------------------------------------------------------ */
/* Internal forwarder                                                  */
/* ------------------------------------------------------------------ */

/**
 * Forward a request to the canonical `/api/public/v1/...` implementation so
 * alias paths behave identically without duplicating logic.
 */
export async function forwardToCanonical(request: Request, canonicalPath: string): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(canonicalPath, url.origin);
  target.search = url.search;
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: await request.arrayBuffer() }),
  };
  const response = await fetch(target.toString(), init);
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}
