import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, json, jsonError } from "@/lib/api-auth.server";
import { corsPreflight } from "@/lib/cors";

// POST /api/public/v1/uploads/:id/complete
// Assembles all chunks into a single object at files/{user_id}/{fileId}/{filename}
// and inserts a `files` row.
export const Route = createFileRoute("/api/public/v1/uploads/$id/complete")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        const caller = await authenticateApiKey(request);
        if (!caller) return jsonError("Invalid, revoked or missing API key", 401, "invalid_api_key");
        if (!caller.scopes.includes("upload")) return jsonError("This API key is missing the 'upload' scope.", 403, "insufficient_scope");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sess } = await supabaseAdmin
          .from("upload_sessions")
          .select("*")
          .eq("id", params.id)
          .eq("user_id", caller.userId)
          .maybeSingle();
        if (!sess) return jsonError("not found", 404);
        if (sess.status === "completed" && sess.file_id) {
          return json({ file_id: sess.file_id, status: "completed" });
        }
        if (sess.status !== "active") return jsonError(`session ${sess.status}`, 409);

        const uploaded = new Set<number>(sess.uploaded_chunks as number[]);
        for (let i = 0; i < sess.total_chunks; i++) {
          if (!uploaded.has(i)) return jsonError(`missing chunk ${i}`, 409);
        }

        // Download & concat all chunks
        const bucket = supabaseAdmin.storage.from("user-files");
        const parts: Uint8Array[] = [];
        let total = 0;
        for (let i = 0; i < sess.total_chunks; i++) {
          const { data: blob, error } = await bucket.download(`${sess.storage_prefix}${i}`);
          if (error || !blob) return jsonError(`chunk ${i} missing in storage`, 500);
          const ab = await blob.arrayBuffer();
          parts.push(new Uint8Array(ab));
          total += ab.byteLength;
        }
        if (total !== sess.total_size) {
          return jsonError(`assembled size ${total} != expected ${sess.total_size}`, 500);
        }

        const merged = new Uint8Array(total);
        let off = 0;
        for (const p of parts) {
          merged.set(p, off);
          off += p.length;
        }

        const fileId = crypto.randomUUID();
        const finalPath = `${caller.userId}/${fileId}/${sess.filename}`;
        const { error: upErr } = await bucket.upload(finalPath, merged, {
          contentType: sess.mime_type ?? "application/octet-stream",
          upsert: false,
        });
        if (upErr) return jsonError(upErr.message, 500);

        const { data: fileRow, error: insErr } = await supabaseAdmin
          .from("files")
          .insert({
            id: fileId,
            user_id: caller.userId,
            folder_id: sess.folder_id,
            name: sess.filename,
            size: sess.total_size,
            mime_type: sess.mime_type,
            storage_path: finalPath,
            password_hash: sess.password_hash,
          })
          .select("id, name, size, mime_type, created_at")
          .single();
        if (insErr) return jsonError(insErr.message, 500);

        await supabaseAdmin
          .from("upload_sessions")
          .update({ status: "completed", file_id: fileRow.id })
          .eq("id", sess.id);

        // Cleanup chunks
        const paths = Array.from({ length: sess.total_chunks }, (_, i) => `${sess.storage_prefix}${i}`);
        await bucket.remove(paths);

        return json({ status: "completed", file: fileRow });
      },
    },
  },
});
