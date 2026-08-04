import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// PATCH  /api/public/v1/folders/{id}  -> { name?, parent_id? }
// DELETE /api/public/v1/folders/{id}  -> only when empty
export const Route = createFileRoute("/api/public/v1/folders/$id")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      PATCH: async ({ request, params }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid, revoked or missing API key", 401, "invalid_api_key");
        if (!auth.scopes.includes("manage")) return jsonError("This API key is missing the 'manage' scope.", 403, "insufficient_scope");
        const body = (await request.json().catch(() => null)) as
          | { name?: unknown; parent_id?: unknown }
          | null;
        if (!body) return jsonError("body required", 400);

        const patch: { name?: string; parent_id?: string | null } = {};
        if (body.name !== undefined) {
          const name = String(body.name).trim().slice(0, 120);
          if (!name) return jsonError("Invalid 'name'", 400);
          patch.name = name;
        }
        if (body.parent_id !== undefined) {
          patch.parent_id = body.parent_id === null ? null : String(body.parent_id);
          if (patch.parent_id === params.id) return jsonError("A folder cannot be its own parent", 400);
        }
        if (Object.keys(patch).length === 0) return jsonError("Nothing to update", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("folders")
          .update(patch)
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .select("id,name,parent_id,updated_at")
          .maybeSingle();
        if (error) return jsonError(error.message, 500);
        if (!data) return jsonError("Not found", 404);
        return json(data);
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid, revoked or missing API key", 401, "invalid_api_key");
        if (!auth.scopes.includes("manage")) return jsonError("This API key is missing the 'manage' scope.", 403, "insufficient_scope");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: folder } = await supabaseAdmin
          .from("folders")
          .select("id")
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (!folder) return jsonError("Not found", 404);

        const { count: files } = await supabaseAdmin
          .from("files")
          .select("id", { count: "exact", head: true })
          .eq("folder_id", folder.id)
          .eq("is_trashed", false);
        const { count: children } = await supabaseAdmin
          .from("folders")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", folder.id);
        if ((files ?? 0) > 0 || (children ?? 0) > 0) {
          return jsonError("Folder is not empty", 409);
        }
        const { error } = await supabaseAdmin.from("folders").delete().eq("id", folder.id);
        if (error) return jsonError(error.message, 500);
        return json({ ok: true });
      },
    },
  },
});
