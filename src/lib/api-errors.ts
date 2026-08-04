// Consistent JSON error format + machine-readable error codes for the public API.
// Pure logic only — safe to import from client and server code.

export const API_SCOPES = ["read", "download", "upload", "manage"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  read: "List and read file/folder metadata and account info",
  download: "Mint signed download URLs and fetch file contents",
  upload: "Create files: direct, signed-URL and chunked uploads",
  manage: "Rename, move, favorite, trash and delete files and folders",
};

export function normalizeScopes(input: unknown): ApiScope[] {
  const list = Array.isArray(input) ? input : [];
  const out = API_SCOPES.filter((s) => list.includes(s));
  return out.length ? out : [];
}

export function hasScope(scopes: readonly string[], required: ApiScope): boolean {
  return scopes.includes(required);
}

/** Canonical error codes -> default HTTP status. */
export const API_ERROR_CODES = {
  bad_request: 400,
  invalid_json: 400,
  validation_failed: 400,
  missing_api_key: 401,
  invalid_api_key: 401,
  unauthorized: 401,
  insufficient_scope: 403,
  file_locked: 403,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  upload_incomplete: 409,
  idempotency_in_progress: 409,
  idempotency_key_reused: 409,
  session_expired: 410,
  gone: 410,
  payload_too_large: 413,
  quota_exceeded: 413,
  rate_limited: 429,
  quota_exhausted: 429,
  internal_error: 500,
  storage_error: 500,
  service_unavailable: 503,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;

const STATUS_FALLBACK: Record<number, ApiErrorCode> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  409: "conflict",
  410: "gone",
  413: "payload_too_large",
  429: "rate_limited",
  500: "internal_error",
  503: "service_unavailable",
};

export function codeForStatus(status: number): ApiErrorCode {
  return STATUS_FALLBACK[status] ?? (status >= 500 ? "internal_error" : "bad_request");
}

export function statusForCode(code: ApiErrorCode): number {
  return API_ERROR_CODES[code];
}

export type ApiErrorBody = {
  error: string;
  code: ApiErrorCode;
  status: number;
  details?: unknown;
  documentation_url: string;
};

export const DOCS_URL = "https://cloud.egreedtech.org/developer-docs";

export function buildErrorBody(
  message: string,
  status: number,
  code?: ApiErrorCode,
  details?: unknown,
): ApiErrorBody {
  const resolved = code ?? codeForStatus(status);
  return {
    error: message,
    code: resolved,
    status,
    ...(details === undefined ? {} : { details }),
    documentation_url: DOCS_URL,
  };
}
