import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// GET /api/public/v1/me -> account + quota info for the calling API key.
export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("id, display_name, storage_used, storage_quota")
          .eq("id", auth.userId)
          .maybeSingle();
        const { count: fileCount } = await supabaseAdmin
          .from("files")
          .select("id", { count: "exact", head: true })
          .eq("user_id", auth.userId)
          .eq("is_trashed", false);

        const used = Number(prof?.storage_used ?? 0);
        const quota = Number(prof?.storage_quota ?? 0);
        return json({
          user_id: auth.userId,
          key_id: auth.keyId,
          display_name: prof?.display_name ?? null,
          files: fileCount ?? 0,
          storage: {
            used_bytes: used,
            quota_bytes: quota,
            remaining_bytes: Math.max(0, quota - used),
            used_percent: quota ? Math.round((used / quota) * 1000) / 10 : 0,
          },
        });
      },
    },
  },
});
