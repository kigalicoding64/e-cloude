import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, clampExpiresIn, expiryInfo } from "@/lib/cors";

// POST|GET /api/public/v1/files/:id/signed-url
// Body/query: { expires_in?: seconds (30..604800, default 300) }
// Returns a time-limited signed download URL plus its exact expiry timestamp.
export const Route = createFileRoute("/api/public/v1/files/$id/signed-url")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => handle(request, params.id),
      POST: async ({ request, params }) => handle(request, params.id),
    },
  },
});

async function handle(request: Request, id: string): Promise<Response> {
  const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
  const auth = await authenticateApiKey(request);
  if (!auth) return jsonError("Invalid or missing API key", 401);

  let requested: unknown = new URL(request.url).searchParams.get("expires_in");
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && "expires_in" in body) {
      requested = (body as { expires_in?: unknown }).expires_in;
    }
  }
  const expiresIn = clampExpiresIn(requested);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: file } = await supabaseAdmin
    .from("files")
    .select("id, name, size, mime_type, storage_path, password_hash, pin_hash, is_trashed")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!file || file.is_trashed) return jsonError("Not found", 404);
  if (file.password_hash || file.pin_hash) {
    return jsonError("File is locked — unlock it in the dashboard before issuing links", 403);
  }

  const { data: signed, error } = await supabaseAdmin.storage
    .from("user-files")
    .createSignedUrl(file.storage_path, expiresIn, { download: file.name });
  if (error || !signed) return jsonError(error?.message ?? "Could not sign URL", 500);

  return json({
    file_id: file.id,
    name: file.name,
    size: file.size,
    mime_type: file.mime_type,
    download_url: signed.signedUrl,
    ...expiryInfo(expiresIn),
  });
}
