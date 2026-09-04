// Resolves Supabase runtime configuration on the server with a build-time
// fallback. `process.env.SUPABASE_*` is injected by the platform at runtime;
// `import.meta.env.VITE_SUPABASE_*` is inlined at build time, so it remains
// available even when the runtime injection is missing. This keeps public,
// unauthenticated probes (health/ready/metrics) working instead of hard-failing.

export type ServerSupabaseConfig = {
  url: string | undefined;
  publishableKey: string | undefined;
  hasServiceRole: boolean;
  source: "runtime" | "build" | "none";
};

export function getServerSupabaseConfig(): ServerSupabaseConfig {
  const runtimeUrl = process.env["SUPABASE_URL"];
  const runtimeKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const buildUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const buildKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  const url = runtimeUrl || buildUrl;
  const publishableKey = runtimeKey || buildKey;

  return {
    url,
    publishableKey,
    hasServiceRole: Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
    source: runtimeUrl && runtimeKey ? "runtime" : url && publishableKey ? "build" : "none",
  };
}

/** Reachability check that needs no service-role key. */
export async function checkSupabaseReachable(): Promise<"ok" | "error" | "unknown"> {
  const { url, publishableKey } = getServerSupabaseConfig();
  if (!url) return "unknown";
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: publishableKey ? { apikey: publishableKey } : {},
    });
    return res.status < 500 ? "ok" : "error";
  } catch {
    return "error";
  }
}
