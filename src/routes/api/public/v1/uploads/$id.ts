import { createFileRoute } from "@tanstack/react-router";
import { authenticateApiKey, json, jsonError } from "@/lib/api-auth.server";
import { corsPreflight } from "@/lib/cors";

// GET /api/public/v1/uploads/:id  -> status (for resume)
// DELETE /api/public/v1/uploads/:id -> abort + cleanup chunks
export const Route = createFileRoute("/api/public/v1/uploads/$id")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const caller = await authenticateApiKey(request);
        if (!caller) return jsonError("invalid API key", 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("upload_sessions")
          .select("id, filename, total_size, chunk_size, total_chunks, uploaded_chunks, status, expires_at, file_id")
          .eq("id", params.id)
          .eq("user_id", caller.userId)
          .maybeSingle();
        if (!data) return jsonError("not found", 404);
        const uploaded = (data.uploaded_chunks ?? []) as number[];
        const missing: number[] = [];
        for (let i = 0; i < data.total_chunks; i++) {
          if (!uploaded.includes(i)) missing.push(i);
        }
        return json({ ...data, missing_chunks: missing });
      },
      DELETE: async ({ request, params }) => {
        const caller = await authenticateApiKey(request);
        if (!caller) return jsonError("invalid API key", 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sess } = await supabaseAdmin
          .from("upload_sessions")
          .select("id, storage_prefix, user_id, status, uploaded_chunks")
          .eq("id", params.id)
          .eq("user_id", caller.userId)
          .maybeSingle();
        if (!sess) return jsonError("not found", 404);
        // Best-effort cleanup of chunks
        const paths = (sess.uploaded_chunks as number[]).map((i) => `${sess.storage_prefix}${i}`);
        if (paths.length) await supabaseAdmin.storage.from("user-files").remove(paths);
        await supabaseAdmin
          .from("upload_sessions")
          .update({ status: "aborted" })
          .eq("id", sess.id);
        return json({ ok: true });
      },
    },
  },
});
