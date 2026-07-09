// Resolves an API key (X-API-Key: eck_live_...) to its owner user_id.
import { sha256Hex } from "@/lib/hash";

export type ApiCaller = { userId: string; keyId: string };

export async function authenticateApiKey(request: Request): Promise<ApiCaller | null> {
  const key =
    request.headers.get("x-api-key") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!key || !key.startsWith("eck_")) return null;
  const key_hash = await sha256Hex(key);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, is_active")
    .eq("key_hash", key_hash)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return { userId: data.user_id, keyId: data.id };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status: number): Response {
  return json({ error: message }, status);
}
