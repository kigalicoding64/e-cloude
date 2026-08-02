import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, clampExpiresIn, expiryInfo } from "@/lib/cors";
import { randomToken } from "@/lib/hash";

// POST /api/public/v1/files/upload-url
// Body: { filename, size?, mime_type?, folder_id?, expires_in? }
// Returns a time-limited signed UPLOAD url. PUT the bytes there, then call
// POST /api/public/v1/files/commit to register the file in the account.
export const Route = createFileRoute("/api/public/v1/files/upload-url")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);

        const body = (await request.json().catch(() => null)) as {
          filename?: unknown; size?: unknown; mime_type?: unknown; folder_id?: unknown; expires_in?: unknown;
        } | null;
        const filename = String(body?.filename ?? "").trim().slice(0, 200);
        if (!filename) return jsonError("Missing 'filename'", 400);
        const size = Number(body?.size ?? 0);
        if (size && (!Number.isFinite(size) || size <= 0)) return jsonError("Invalid 'size'", 400);
        const expiresIn = clampExpiresIn(body?.expires_in);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (size) {
          const { data: prof } = await supabaseAdmin
            .from("profiles").select("storage_used, storage_quota").eq("id", auth.userId).maybeSingle();
          if (prof && Number(prof.storage_used) + size > Number(prof.storage_quota)) {
            return jsonError("Storage quota exceeded", 413);
          }
        }

        const storagePath = `${auth.userId}/${randomToken(16)}-${filename}`;
        const { data: signed, error } = await supabaseAdmin.storage
          .from("user-files")
          .createSignedUploadUrl(storagePath);
        if (error || !signed) return jsonError(error?.message ?? "Could not sign upload URL", 500);

        return json({
          upload_url: signed.signedUrl,
          upload_token: signed.token,
          method: "PUT",
          storage_path: storagePath,
          commit_url: "/api/public/v1/files/commit",
          folder_id: body?.folder_id ? String(body.folder_id) : null,
          mime_type: body?.mime_type ? String(body.mime_type) : null,
          ...expiryInfo(expiresIn),
        }, 201);
      },
    },
  },
});
