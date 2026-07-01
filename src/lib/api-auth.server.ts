// Server-only helper — resolves an API key from the X-API-Key header to a user_id.
// Uses supabaseAdmin (service role). Import inside handlers only.
import { sha256Hex } from "@/lib/hash";

export async function authenticateApiKey(request: Request): Promise<{ userId: string; keyId: string } | null> {
  const key = request.headers.get("x-api-key");
  if (!key || !key.startsWith("eck_")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const key_hash = await sha256Hex(key);
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, is_active")
    .eq("key_hash", key_hash)
    .maybeSingle();
  if (error || !data || !data.is_active) return null;
  // fire-and-forget last_used update
  supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return { userId: data.user_id, keyId: data.id };
}

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
