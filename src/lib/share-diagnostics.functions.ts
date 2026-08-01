import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PUBLIC_BASE_URL = "https://cloud.egreedtech.org";

/** Accepts a raw token, a /s/<token> path, or a full share URL. */
export function extractShareToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(?:\/s\/)([A-Za-z0-9_-]+)/);
  const token = match ? match[1] : trimmed.replace(/^\/+/, "");
  return /^[A-Za-z0-9_-]{8,128}$/.test(token) ? token : null;
}

export type ShareDiagnostic = {
  token: string;
  url: string;
  found: boolean;
  expired: boolean;
  expires_at: string | null;
  requires_password: boolean;
  permission: string | null;
  view_count: number | null;
  file_present: boolean;
  file_name: string | null;
  file_locked: boolean;
  created_at: string | null;
  verdict: "valid" | "expired" | "missing" | "file-missing";
};

export const diagnoseShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { input: string }) => d)
  .handler(async ({ data, context }): Promise<ShareDiagnostic> => {
    const token = extractShareToken(data.input);
    if (!token) throw new Error("That doesn't look like a share link or token");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base: ShareDiagnostic = {
      token,
      url: `${PUBLIC_BASE_URL}/s/${token}`,
      found: false,
      expired: false,
      expires_at: null,
      requires_password: false,
      permission: null,
      view_count: null,
      file_present: false,
      file_name: null,
      file_locked: false,
      created_at: null,
      verdict: "missing",
    };

    const { data: share } = await supabaseAdmin
      .from("shares")
      .select(
        "id, created_by, token, permission, expires_at, password_hash, view_count, created_at, files(name, password_hash, pin_hash)",
      )
      .eq("token", token)
      .maybeSingle();

    if (!share) return base;

    // Only the link creator (or an admin) may inspect a link.
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (share.created_by !== context.userId && !isAdmin) return base;

    const file = (share as { files: { name: string; password_hash: string | null; pin_hash: string | null } | null }).files;
    const expired = !!share.expires_at && new Date(share.expires_at) < new Date();

    return {
      ...base,
      found: true,
      expired,
      expires_at: share.expires_at ?? null,
      requires_password: !!share.password_hash,
      permission: share.permission,
      view_count: share.view_count,
      file_present: !!file,
      file_name: file?.name ?? null,
      file_locked: !!(file?.password_hash || file?.pin_hash),
      created_at: share.created_at,
      verdict: !file ? "file-missing" : expired ? "expired" : "valid",
    };
  });
