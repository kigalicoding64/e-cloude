import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/files/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);
        const url = new URL(request.url);
        const folder = url.searchParams.get("folder");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("files")
          .select("id,name,size,mime_type,folder_id,is_favorite,created_at,updated_at")
          .eq("user_id", auth.userId)
          .eq("is_trashed", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (folder) q = q.eq("folder_id", folder);
        const { data, error } = await q;
        if (error) return jsonError(error.message, 500);
        return json({ files: data, limit, offset });
      },
    },
  },
});
