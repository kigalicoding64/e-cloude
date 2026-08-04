import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, clampExpiresIn, expiryInfo } from "@/lib/cors";

// POST|GET /api/public/v1/files/:id/signed-url
// Body/query: { expires_in?: seconds (30..604800, default 300) }
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
  const { authorize, json, apiError } = await import("@/lib/api-auth.server");
  const { caller, error } = await authorize(request, "download");
  if (error) return error;

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
    .eq("user_id", caller.userId)
    .maybeSingle();
  if (!file || file.is_trashed) return apiError("not_found", "File not found");
  if (file.password_hash || file.pin_hash) {
    return apiError("file_locked", "File is locked — unlock it in the dashboard before issuing links");
  }

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from("user-files")
    .createSignedUrl(file.storage_path, expiresIn, { download: file.name });
  if (signErr || !signed) return apiError("storage_error", signErr?.message ?? "Could not sign URL");

  return json({
    file_id: file.id,
    name: file.name,
    size: file.size,
    mime_type: file.mime_type,
    download_url: signed.signedUrl,
    ...expiryInfo(expiresIn),
  });
}
