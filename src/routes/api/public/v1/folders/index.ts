import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET  /api/public/v1/folders            -> list folders (scope: read)
// POST /api/public/v1/folders            -> { name, parent_id? } (scope: manage)
export const Route = createFileRoute("/api/public/v1/folders/")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { authorize, json, apiError } = await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "read");
        if (error) return error;
        const url = new URL(request.url);
        const parent = url.searchParams.get("parent");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("folders")
          .select("id,name,parent_id,created_at,updated_at")
          .eq("user_id", caller.userId)
          .order("name", { ascending: true });
        if (parent) q = q.eq("parent_id", parent);
        const { data, error: dbErr } = await q;
        if (dbErr) return apiError("internal_error", dbErr.message);
        return json({ folders: data ?? [] });
      },
      POST: async ({ request }) => {
        const { authorize, json, apiError } = await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "manage");
        if (error) return error;
        const body = (await request.json().catch(() => null)) as
          | { name?: unknown; parent_id?: unknown }
          | null;
        const name = String(body?.name ?? "").trim().slice(0, 120);
        if (!name) return apiError("validation_failed", "Missing 'name'");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let parentId: string | null = null;
        if (body?.parent_id) {
          parentId = String(body.parent_id);
          const { data: parent } = await supabaseAdmin
            .from("folders")
            .select("id")
            .eq("id", parentId)
            .eq("user_id", caller.userId)
            .maybeSingle();
          if (!parent) return apiError("not_found", "Parent folder not found");
        }
        const { data, error: dbErr } = await supabaseAdmin
          .from("folders")
          .insert({ user_id: caller.userId, name, parent_id: parentId })
          .select("id,name,parent_id,created_at")
          .single();
        if (dbErr) return apiError("internal_error", dbErr.message);
        return json(data, 201);
      },
    },
  },
});
