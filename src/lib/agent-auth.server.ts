// Server-only helper — resolves an agent bearer token to an orchestrator row.
export async function authenticateAgent(request: Request): Promise<{ orchestratorId: string; baseUrl: string } | null> {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("ai_orchestrators")
    .select("id, base_url")
    .eq("agent_token", token)
    .maybeSingle();
  if (error || !data) return null;
  // Update heartbeat + mark online (fire and forget)
  supabaseAdmin
    .from("ai_orchestrators")
    .update({ last_heartbeat_at: new Date().toISOString(), status: "online" })
    .eq("id", data.id)
    .then(() => {});
  return { orchestratorId: data.id, baseUrl: data.base_url };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
