import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";
import { hasScope } from "@/lib/api-errors";

export const Route = createFileRoute("/api/public/v1/files/$id")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const { authorize, json, apiError } = await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "read");
        if (error) return error;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error: dbErr } = await supabaseAdmin.from("files")
          .select("*").eq("id", params.id).eq("user_id", caller.userId).maybeSingle();
        if (dbErr) return apiError("internal_error", dbErr.message);
        if (!data) return apiError("not_found", "File not found");
        const canDownload = hasScope(caller.scopes, "download") && !data.password_hash && !data.pin_hash;
        const signed = canDownload
          ? (await supabaseAdmin.storage.from("user-files").createSignedUrl(data.storage_path, 60)).data
          : null;
        return json({
          id: data.id, name: data.name, size: data.size, mime_type: data.mime_type,
          folder_id: data.folder_id, is_favorite: data.is_favorite,
          is_locked: Boolean(data.password_hash || data.pin_hash),
          created_at: data.created_at, updated_at: data.updated_at,
          download_url: signed?.signedUrl ?? null,
          download_expires_in: signed ? 60 : null,
          download_expires_at: signed ? new Date(Date.now() + 60_000).toISOString() : null,
        });
      },
      PATCH: async ({ request, params }) => {
        const { authorize, json, apiError } = await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "manage");
        if (error) return error;
        const body = (await request.json().catch(() => null)) as
          | { name?: unknown; folder_id?: unknown; is_favorite?: unknown; is_trashed?: unknown }
          | null;
        if (!body) return apiError("invalid_json", "A JSON body is required");

        const patch: {
          name?: string;
          folder_id?: string | null;
          is_favorite?: boolean;
          is_trashed?: boolean;
          trashed_at?: string | null;
        } = {};
        if (body.name !== undefined) {
          const name = String(body.name).trim().slice(0, 200);
          if (!name) return apiError("validation_failed", "Invalid 'name'");
          patch.name = name;
        }
        if (body.folder_id !== undefined) patch.folder_id = body.folder_id === null ? null : String(body.folder_id);
        if (body.is_favorite !== undefined) patch.is_favorite = Boolean(body.is_favorite);
        if (body.is_trashed !== undefined) {
          patch.is_trashed = Boolean(body.is_trashed);
          patch.trashed_at = patch.is_trashed ? new Date().toISOString() : null;
        }
        if (Object.keys(patch).length === 0) return apiError("validation_failed", "Nothing to update");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (typeof patch.folder_id === "string") {
          const { data: folder } = await supabaseAdmin
            .from("folders").select("id").eq("id", patch.folder_id).eq("user_id", caller.userId).maybeSingle();
          if (!folder) return apiError("not_found", "Folder not found");
        }
        const { data, error: dbErr } = await supabaseAdmin
          .from("files")
          .update(patch)
          .eq("id", params.id)
          .eq("user_id", caller.userId)
          .select("id,name,size,mime_type,folder_id,is_favorite,is_trashed,updated_at")
          .maybeSingle();
        if (dbErr) return apiError("internal_error", dbErr.message);
        if (!data) return apiError("not_found", "File not found");
        return json(data);
      },
      DELETE: async ({ request, params }) => {
        const { authorize, json, apiError } = await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "manage");
        if (error) return error;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: file } = await supabaseAdmin.from("files")
          .select("id, size, storage_path").eq("id", params.id).eq("user_id", caller.userId).maybeSingle();
        if (!file) return apiError("not_found", "File not found");
        await supabaseAdmin.storage.from("user-files").remove([file.storage_path]);
        const { error: dbErr } = await supabaseAdmin.from("files").delete().eq("id", file.id);
        if (dbErr) return apiError("internal_error", dbErr.message);
        const { data: prof } = await supabaseAdmin.from("profiles").select("storage_used").eq("id", caller.userId).maybeSingle();
        const newUsed = Math.max(0, Number(prof?.storage_used ?? 0) - Number(file.size));
        await supabaseAdmin.from("profiles").update({ storage_used: newUsed }).eq("id", caller.userId);
        return json({ ok: true, deleted_id: file.id });
      },
    },
  },
});
