import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, json, jsonError } from "@/lib/api-auth.server";
import { corsPreflight } from "@/lib/cors";

// PUT /api/public/v1/uploads/:id/chunks/:index
// Body: raw bytes of the chunk. Idempotent — re-uploads OK.
export const Route = createFileRoute("/api/public/v1/uploads/$id/chunks/$index")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      PUT: async ({ request, params }) => {
        const caller = await authenticateApiKey(request);
        if (!caller) return jsonError("Invalid, revoked or missing API key", 401, "invalid_api_key");
        if (!caller.scopes.includes("upload")) return jsonError("This API key is missing the 'upload' scope.", 403, "insufficient_scope");
        const index = Number(params.index);
        if (!Number.isInteger(index) || index < 0) return jsonError("bad chunk index", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sess } = await supabaseAdmin
          .from("upload_sessions")
          .select("id, user_id, status, total_chunks, chunk_size, total_size, storage_prefix, uploaded_chunks, expires_at")
          .eq("id", params.id)
          .eq("user_id", caller.userId)
          .maybeSingle();
        if (!sess) return jsonError("session not found", 404);
        if (sess.status !== "active") return jsonError(`session ${sess.status}`, 409);
        if (new Date(sess.expires_at).getTime() < Date.now()) {
          await supabaseAdmin.from("upload_sessions").update({ status: "expired" }).eq("id", sess.id);
          return jsonError("session expired", 410);
        }
        if (index >= sess.total_chunks) return jsonError("chunk index out of range", 400);

        const buf = await request.arrayBuffer();
        // Verify chunk size (last chunk may be smaller)
        const expected =
          index === sess.total_chunks - 1
            ? sess.total_size - index * sess.chunk_size
            : sess.chunk_size;
        if (buf.byteLength !== expected) {
          return jsonError(`chunk size mismatch: expected ${expected}, got ${buf.byteLength}`, 400);
        }

        const path = `${sess.storage_prefix}${index}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("user-files")
          .upload(path, buf, { contentType: "application/octet-stream", upsert: true });
        if (upErr) return jsonError(upErr.message, 500);

        const uploaded = new Set<number>(sess.uploaded_chunks as number[]);
        uploaded.add(index);
        const arr = Array.from(uploaded).sort((a, b) => a - b);
        await supabaseAdmin
          .from("upload_sessions")
          .update({ uploaded_chunks: arr })
          .eq("id", sess.id);

        return json({ index, received: buf.byteLength, uploaded_count: arr.length, total_chunks: sess.total_chunks });
      },
    },
  },
});
