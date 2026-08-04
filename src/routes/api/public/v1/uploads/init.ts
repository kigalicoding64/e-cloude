import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, json, jsonError } from "@/lib/api-auth.server";
import { corsPreflight } from "@/lib/cors";

// POST /api/public/v1/uploads/init
// Body: { filename, size, mime_type?, chunk_size?, folder_id?, password? }
// Returns: { session_id, chunk_size, total_chunks, upload_url_template, expires_at }
export const Route = createFileRoute("/api/public/v1/uploads/init")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const caller = await authenticateApiKey(request);
        if (!caller) return jsonError("Invalid, revoked or missing API key", 401, "invalid_api_key");
        if (!caller.scopes.includes("upload")) return jsonError("This API key is missing the 'upload' scope.", 403, "insufficient_scope");

        let body: any;
        try {
          body = await request.json();
        } catch {
          return jsonError("invalid JSON body", 400);
        }

        const filename = String(body?.filename ?? "").trim();
        const size = Number(body?.size ?? 0);
        const mime_type = body?.mime_type ? String(body.mime_type) : null;
        const folder_id = body?.folder_id ? String(body.folder_id) : null;
        const password = body?.password ? String(body.password) : null;
        // Default chunk 5 MB, max 25 MB, min 256 KB
        let chunk_size = Number(body?.chunk_size ?? 5 * 1024 * 1024);
        chunk_size = Math.max(256 * 1024, Math.min(25 * 1024 * 1024, chunk_size));

        if (!filename || filename.length > 255) return jsonError("invalid filename", 400);
        if (!Number.isFinite(size) || size <= 0) return jsonError("invalid size", 400);
        // Cap total upload at 500MB (worker memory constraints on assembly)
        if (size > 500 * 1024 * 1024) return jsonError("file too large (max 500MB)", 400);

        const total_chunks = Math.ceil(size / chunk_size);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let password_hash: string | null = null;
        if (password) {
          const { sha256Hex } = await import("@/lib/hash");
          password_hash = await sha256Hex(`file-lock:${password}`);
        }

        // Pre-mint session id so we can compute storage_prefix
        const sessionId = crypto.randomUUID();
        const storage_prefix = `uploads/${caller.userId}/${sessionId}/`;

        const { data, error } = await supabaseAdmin
          .from("upload_sessions")
          .insert({
            id: sessionId,
            user_id: caller.userId,
            api_key_id: caller.keyId,
            folder_id,
            filename,
            mime_type,
            total_size: size,
            chunk_size,
            total_chunks,
            storage_prefix,
            password_hash,
          })
          .select("id, chunk_size, total_chunks, expires_at")
          .single();
        if (error) return jsonError(error.message, 500);

        return json({
          session_id: data.id,
          chunk_size: data.chunk_size,
          total_chunks: data.total_chunks,
          expires_at: data.expires_at,
          upload_url_template: `/api/public/v1/uploads/${data.id}/chunks/{index}`,
          status_url: `/api/public/v1/uploads/${data.id}`,
          complete_url: `/api/public/v1/uploads/${data.id}/complete`,
        });
      },
    },
  },
});
