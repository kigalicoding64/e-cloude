import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// POST /api/public/v1/files/commit
// Body: { storage_path, name?, folder_id?, mime_type? }
// Registers a file that was uploaded directly via a signed upload URL.
export const Route = createFileRoute("/api/public/v1/files/commit")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);

        const body = (await request.json().catch(() => null)) as {
          storage_path?: unknown; name?: unknown; folder_id?: unknown; mime_type?: unknown;
        } | null;
        const storagePath = String(body?.storage_path ?? "");
        if (!storagePath.startsWith(`${auth.userId}/`)) {
          return jsonError("Invalid 'storage_path'", 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const dir = storagePath.slice(0, storagePath.lastIndexOf("/")) || auth.userId;
        const base = storagePath.slice(storagePath.lastIndexOf("/") + 1);
        const { data: listed } = await supabaseAdmin.storage.from("user-files").list(dir, { search: base });
        const obj = listed?.find((o) => o.name === base);
        if (!obj) return jsonError("Upload not found in storage — PUT the bytes before committing", 409);
        const size = Number((obj.metadata as { size?: number } | null)?.size ?? 0);
        const mime =
          (body?.mime_type ? String(body.mime_type) : null) ??
          ((obj.metadata as { mimetype?: string } | null)?.mimetype ?? "application/octet-stream");
        const name = String(body?.name ?? base.replace(/^[0-9a-f]{32}-/, "")).slice(0, 200);

        const { data: row, error } = await supabaseAdmin.from("files").insert({
          user_id: auth.userId,
          folder_id: body?.folder_id ? String(body.folder_id) : null,
          name,
          size,
          mime_type: mime,
          storage_path: storagePath,
        }).select("id,name,size,mime_type,folder_id,created_at").single();
        if (error) return jsonError(error.message, 500);

        const { data: prof } = await supabaseAdmin
          .from("profiles").select("storage_used").eq("id", auth.userId).maybeSingle();
        await supabaseAdmin.from("profiles")
          .update({ storage_used: Number(prof?.storage_used ?? 0) + size })
          .eq("id", auth.userId);

        return json(row, 201);
      },
    },
  },
});
