import { createFileRoute } from "@tanstack/react-router";
import { sha256Hex } from "@/lib/hash";
import { corsPreflight } from "@/lib/cors";

// Public share resolver — anyone can request; server checks expiry + password.
export const Route = createFileRoute("/api/public/v1/shares/$token")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        const { json, jsonError } = await import("@/lib/api-auth.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const body = await request.json().catch(() => ({}));
        const password = typeof (body as { password?: unknown }).password === "string" ? (body as { password: string }).password : "";

        const { data: share } = await supabaseAdmin.from("shares").select("*, files(*)").eq("token", params.token).maybeSingle();
        if (!share) return jsonError("Share not found", 404);
        if (share.expires_at && new Date(share.expires_at) < new Date()) return jsonError("Share expired", 410);
        if (share.password_hash) {
          if (!password) return jsonError("Password required", 401);
          const h = await sha256Hex(password);
          if (h !== share.password_hash) return jsonError("Incorrect password", 401);
        }
        const file = (share as { files: { name: string; size: number; mime_type: string; storage_path: string } | null }).files;
        if (!file) return jsonError("File no longer available", 404);
        const { data: signed } = await supabaseAdmin.storage.from("user-files").createSignedUrl(file.storage_path, 300);

        // increment view count (fire and forget)
        supabaseAdmin.from("shares").update({ view_count: share.view_count + 1 }).eq("id", share.id).then(() => {});

        return json({
          name: file.name, size: file.size, mime_type: file.mime_type,
          permission: share.permission,
          download_url: share.permission === "view" ? null : signed?.signedUrl ?? null,
          preview_url: signed?.signedUrl ?? null,
        });
      },
    },
  },
});
