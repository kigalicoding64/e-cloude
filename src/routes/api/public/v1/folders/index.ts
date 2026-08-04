import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET  /api/public/v1/folders            -> list folders
// POST /api/public/v1/folders            -> { name, parent_id? }
export const Route = createFileRoute("/api/public/v1/folders/")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);
        const url = new URL(request.url);
        const parent = url.searchParams.get("parent");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("folders")
          .select("id,name,parent_id,created_at,updated_at")
          .eq("user_id", auth.userId)
          .order("name", { ascending: true });
        if (parent) q = q.eq("parent_id", parent);
        const { data, error } = await q;
        if (error) return jsonError(error.message, 500);
        return json({ folders: data ?? [] });
      },
      POST: async ({ request }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);
        const body = (await request.json().catch(() => null)) as
          | { name?: unknown; parent_id?: unknown }
          | null;
        const name = String(body?.name ?? "").trim().slice(0, 120);
        if (!name) return jsonError("Missing 'name'", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let parentId: string | null = null;
        if (body?.parent_id) {
          parentId = String(body.parent_id);
          const { data: parent } = await supabaseAdmin
            .from("folders")
            .select("id")
            .eq("id", parentId)
            .eq("user_id", auth.userId)
            .maybeSingle();
          if (!parent) return jsonError("Parent folder not found", 404);
        }
        const { data, error } = await supabaseAdmin
          .from("folders")
          .insert({ user_id: auth.userId, name, parent_id: parentId })
          .select("id,name,parent_id,created_at")
          .single();
        if (error) return jsonError(error.message, 500);
        return json(data, 201);
      },
    },
  },
});
