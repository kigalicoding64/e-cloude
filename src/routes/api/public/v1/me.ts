import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";
import { SCOPE_DESCRIPTIONS, type ApiScope } from "@/lib/api-errors";

// GET /api/public/v1/me -> account + quota + granted permissions for the calling key.
export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { authorize, json } = await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request);
        if (error) return error;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("id, display_name, storage_used, storage_quota")
          .eq("id", caller.userId)
          .maybeSingle();
        const { data: key } = await supabaseAdmin
          .from("api_keys")
          .select("name, key_prefix, created_at, last_used_at")
          .eq("id", caller.keyId)
          .maybeSingle();
        const { count: fileCount } = await supabaseAdmin
          .from("files")
          .select("id", { count: "exact", head: true })
          .eq("user_id", caller.userId)
          .eq("is_trashed", false);

        const used = Number(prof?.storage_used ?? 0);
        const quota = Number(prof?.storage_quota ?? 0);
        return json({
          user_id: caller.userId,
          key_id: caller.keyId,
          key_name: key?.name ?? null,
          key_prefix: key?.key_prefix ?? null,
          display_name: prof?.display_name ?? null,
          scopes: caller.scopes,
          permissions: caller.scopes.map((s: ApiScope) => ({
            scope: s,
            description: SCOPE_DESCRIPTIONS[s],
          })),
          can: {
            read: caller.scopes.includes("read"),
            download: caller.scopes.includes("download"),
            upload: caller.scopes.includes("upload"),
            manage: caller.scopes.includes("manage"),
          },
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
