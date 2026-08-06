// Pure, dependency-free helpers shared by every EGREED Cloud file endpoint.
// Safe to import from client and server code (and unit-tested).

import type { ApiScope } from "@/lib/api-errors";

export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

/** Stable, URL-safe client identifier derived from the API key name. */
export function slugifyClientId(name: string | null | undefined, fallback: string): string {
  const slug = (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return slug || fallback;
}

export type ListParams = {
  limit: number;
  offset: number;
  page: number;
  search: string | null;
  folder: string | null;
  includeTrashed: boolean;
};

/** Parse + clamp pagination/search params. Never throws; always returns a usable window. */
export function parseListParams(searchParams: URLSearchParams): ListParams {
  const rawLimit = Number(searchParams.get("limit") ?? searchParams.get("per_page") ?? DEFAULT_PAGE_SIZE);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

  const rawPage = Number(searchParams.get("page") ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawOffset = searchParams.get("offset");
  const parsedOffset = Number(rawOffset);
  const offset =
    rawOffset !== null && Number.isFinite(parsedOffset) && parsedOffset >= 0
      ? Math.floor(parsedOffset)
      : (page - 1) * limit;

  const search = (searchParams.get("search") ?? searchParams.get("q") ?? "").trim().slice(0, 200) || null;
  const folder = searchParams.get("folder") ?? searchParams.get("folder_id");
  const includeTrashed = ["1", "true", "yes"].includes(
    (searchParams.get("include_trashed") ?? "").toLowerCase(),
  );

  return { limit, offset, page, search, folder: folder || null, includeTrashed };
}

/** Permissions granted to the calling client for file resources. */
export function filePermissions(scopes: readonly ApiScope[]): string[] {
  const out: string[] = [];
  if (scopes.includes("read")) out.push("read");
  if (scopes.includes("download")) out.push("download");
  if (scopes.includes("upload")) out.push("write");
  if (scopes.includes("manage")) out.push("manage", "delete");
  return out;
}

export type FileRow = {
  id: string;
  name: string;
  size: number | string;
  mime_type: string | null;
  folder_id: string | null;
  storage_path?: string | null;
  is_favorite?: boolean | null;
  is_trashed?: boolean | null;
  password_hash?: string | null;
  pin_hash?: string | null;
  created_at: string;
  updated_at?: string | null;
  user_id?: string | null;
};

export type ApiFile = {
  file_id: string;
  id: string;
  owner_id: string;
  client_id: string;
  file_name: string;
  name: string;
  file_type: string;
  mime_type: string | null;
  file_size: number;
  size: number;
  folder_id: string | null;
  storage_path: string | null;
  is_favorite: boolean;
  is_trashed: boolean;
  is_locked: boolean;
  permissions: string[];
  created_at: string;
  updated_at: string | null;
};

/**
 * Normalize a database row into the documented public resource shape.
 * Keeps the legacy field names (id/name/size/mime_type) for backward compatibility.
 */
export function toApiFile(
  row: FileRow,
  ctx: { ownerId: string; clientId: string; scopes: readonly ApiScope[] },
): ApiFile {
  return {
    file_id: row.id,
    id: row.id,
    owner_id: row.user_id ?? ctx.ownerId,
    client_id: ctx.clientId,
    file_name: row.name,
    name: row.name,
    file_type: row.mime_type ?? "application/octet-stream",
    mime_type: row.mime_type ?? null,
    file_size: Number(row.size ?? 0),
    size: Number(row.size ?? 0),
    folder_id: row.folder_id ?? null,
    storage_path: row.storage_path ?? null,
    is_favorite: Boolean(row.is_favorite),
    is_trashed: Boolean(row.is_trashed),
    is_locked: Boolean(row.password_hash || row.pin_hash),
    permissions: filePermissions(ctx.scopes),
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

/** Escape PostgREST `ilike` wildcards so a search term can't alter the pattern. */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[%_,()\\]/g, (m) => `\\${m}`);
}
