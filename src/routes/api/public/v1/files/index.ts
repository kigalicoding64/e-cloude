import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

export const Route = createFileRoute("/api/public/v1/files/")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { authorize, json, apiError } = await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "read");
        if (error) return error;
        const url = new URL(request.url);
        const folder = url.searchParams.get("folder");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(offset) || offset < 0) {
          return apiError("validation_failed", "Invalid 'limit' or 'offset'");
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("files")
          .select("id,name,size,mime_type,folder_id,is_favorite,created_at,updated_at")
          .eq("user_id", caller.userId)
          .eq("is_trashed", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (folder) q = q.eq("folder_id", folder);
        const { data, error: dbErr } = await q;
        if (dbErr) return apiError("internal_error", dbErr.message);
        return json({ files: data, limit, offset });
      },
    },
  },
});
