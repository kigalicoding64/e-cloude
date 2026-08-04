import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, clampExpiresIn, expiryInfo } from "@/lib/cors";
import { randomToken } from "@/lib/hash";

// POST /api/public/v1/files/upload-url
// Body: { filename, size?, mime_type?, folder_id?, expires_in? }
// Supports Idempotency-Key: retrying returns the same signed upload target.
export const Route = createFileRoute("/api/public/v1/files/upload-url")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const { authorize, apiError, withIdempotency } = await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "upload");
        if (error) return error;

        const body = (await request.json().catch(() => null)) as {
          filename?: unknown; size?: unknown; mime_type?: unknown; folder_id?: unknown; expires_in?: unknown;
        } | null;
        const filename = String(body?.filename ?? "").trim().slice(0, 200);
        if (!filename) return apiError("validation_failed", "Missing 'filename'");
        const size = Number(body?.size ?? 0);
        if (size && (!Number.isFinite(size) || size <= 0)) return apiError("validation_failed", "Invalid 'size'");
        const expiresIn = clampExpiresIn(body?.expires_in);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (size) {
          const { data: prof } = await supabaseAdmin
            .from("profiles").select("storage_used, storage_quota").eq("id", caller.userId).maybeSingle();
          if (prof && Number(prof.storage_used) + size > Number(prof.storage_quota)) {
            return apiError("quota_exceeded", "Storage quota exceeded");
          }
        }

        return withIdempotency(
          request,
          caller,
          "POST /files/upload-url",
          `${filename}:${size}`,
          async () => {
            const storagePath = `${caller.userId}/${randomToken(16)}-${filename}`;
            const { data: signed, error: signErr } = await supabaseAdmin.storage
              .from("user-files")
              .createSignedUploadUrl(storagePath);
            if (signErr || !signed) {
              throw new Error(signErr?.message ?? "Could not sign upload URL");
            }
            return {
              status: 201,
              body: {
                upload_url: signed.signedUrl,
                upload_token: signed.token,
                method: "PUT",
                storage_path: storagePath,
                commit_url: "/api/public/v1/files/commit",
                folder_id: body?.folder_id ? String(body.folder_id) : null,
                mime_type: body?.mime_type ? String(body.mime_type) : null,
                retry: {
                  retry_on_status: [408, 425, 429, 500, 502, 503, 504],
                  strategy: "exponential backoff with jitter, base 500ms, max 15s",
                  note: "PUT is idempotent — safe to retry the same upload_url until it expires.",
                },
                ...expiryInfo(expiresIn),
              },
            };
          },
        );
      },
    },
  },
});
