import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

export const Route = createFileRoute("/api/public/v1/files/$id")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("files")
          .select("*").eq("id", params.id).eq("user_id", auth.userId).maybeSingle();
        if (error) return jsonError(error.message, 500);
        if (!data) return jsonError("Not found", 404);
        const { data: signed } = await supabaseAdmin.storage.from("user-files").createSignedUrl(data.storage_path, 60);
        return json({
          id: data.id, name: data.name, size: data.size, mime_type: data.mime_type,
          folder_id: data.folder_id, is_favorite: data.is_favorite,
          created_at: data.created_at, updated_at: data.updated_at,
          download_url: signed?.signedUrl ?? null,
          download_expires_in: 60,
        });
      },
      PATCH: async ({ request, params }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);
        const body = (await request.json().catch(() => null)) as
          | { name?: unknown; folder_id?: unknown; is_favorite?: unknown; is_trashed?: unknown }
          | null;
        if (!body) return jsonError("body required", 400);

        const patch: Record<string, unknown> = {};
        if (body.name !== undefined) {
          const name = String(body.name).trim().slice(0, 200);
          if (!name) return jsonError("Invalid 'name'", 400);
          patch.name = name;
        }
        if (body.folder_id !== undefined) patch.folder_id = body.folder_id === null ? null : String(body.folder_id);
        if (body.is_favorite !== undefined) patch.is_favorite = Boolean(body.is_favorite);
        if (body.is_trashed !== undefined) {
          patch.is_trashed = Boolean(body.is_trashed);
          patch.trashed_at = patch.is_trashed ? new Date().toISOString() : null;
        }
        if (Object.keys(patch).length === 0) return jsonError("Nothing to update", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (typeof patch.folder_id === "string") {
          const { data: folder } = await supabaseAdmin
            .from("folders").select("id").eq("id", patch.folder_id).eq("user_id", auth.userId).maybeSingle();
          if (!folder) return jsonError("Folder not found", 404);
        }
        const { data, error } = await supabaseAdmin
          .from("files")
          .update(patch)
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .select("id,name,size,mime_type,folder_id,is_favorite,is_trashed,updated_at")
          .maybeSingle();
        if (error) return jsonError(error.message, 500);
        if (!data) return jsonError("Not found", 404);
        return json(data);
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: file } = await supabaseAdmin.from("files")
          .select("id, size, storage_path").eq("id", params.id).eq("user_id", auth.userId).maybeSingle();
        if (!file) return jsonError("Not found", 404);
        await supabaseAdmin.storage.from("user-files").remove([file.storage_path]);
        const { error } = await supabaseAdmin.from("files").delete().eq("id", file.id);
        if (error) return jsonError(error.message, 500);
        const { data: prof } = await supabaseAdmin.from("profiles").select("storage_used").eq("id", auth.userId).maybeSingle();
        const newUsed = Math.max(0, Number(prof?.storage_used ?? 0) - Number(file.size));
        await supabaseAdmin.from("profiles").update({ storage_used: newUsed }).eq("id", auth.userId);
        return json({ ok: true });
      },
    },
  },
});
