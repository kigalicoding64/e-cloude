import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  LIVE_TARGETS,
  PROBE_PATHS,
  type ApiAuthCheck,
  type BindingCheck,
  type BindingStatus,
  type CorsCheck,
  type JsonLike,
  type LiveTarget,
  type ProbeResult,
  type SignedUrlCheck,
  type TargetProbe,
  type VerificationRecord,
} from "@/lib/platform-health";

const PROBE_TIMEOUT_MS = 12_000;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Administrator access required");
}

/** Names only — never values. */
const BINDING_SPEC: Array<Omit<BindingCheck, "present">> = [
  { name: "SUPABASE_URL", required: true, used_for: "Server-side database, storage and auth calls" },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    used_for: "Privileged server access for the public API (never sent to the browser)",
  },
  {
    name: "SUPABASE_PUBLISHABLE_KEY",
    required: true,
    used_for: "Verifying signed-in users inside server functions",
  },
  { name: "VITE_SUPABASE_URL", required: true, used_for: "Browser database and auth calls" },
  {
    name: "VITE_SUPABASE_PUBLISHABLE_KEY",
    required: true,
    used_for: "Browser database and auth calls",
  },
  { name: "LOVABLE_API_KEY", required: false, used_for: "AI assistant and AI gateway features" },
];

function readBindingStatus(): BindingStatus {
  const checked: BindingCheck[] = BINDING_SPEC.map((spec) => ({
    ...spec,
    present: Boolean(process.env[spec.name] && String(process.env[spec.name]).trim().length > 0),
  }));
  const missing_required = checked.filter((c) => c.required && !c.present).map((c) => c.name);
  const missing_optional = checked.filter((c) => !c.required && !c.present).map((c) => c.name);
  return {
    checked,
    missing_required,
    missing_optional,
    ok: missing_required.length === 0,
    checked_at: new Date().toISOString(),
  };
}

async function probe(baseUrl: string, path: string): Promise<ProbeResult> {
  const url = `${baseUrl}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const contentType = res.headers.get("content-type");
    let body: JsonLike = null;
    const text = await res.text();
    try {
      body = JSON.parse(text) as JsonLike;
    } catch {
      body = text.slice(0, 300);
    }
    return {
      path,
      url,
      ok: res.ok,
      status: res.status,
      duration_ms: Date.now() - started,
      body,
      content_type: contentType,
      error: null,
    };
  } catch (e) {
    return {
      path,
      url,
      ok: false,
      status: null,
      duration_ms: Date.now() - started,
      body: null,
      content_type: null,
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

async function probeTarget(target: LiveTarget): Promise<TargetProbe> {
  const probes = await Promise.all(PROBE_PATHS.map((p) => probe(target.baseUrl, p)));
  return { target, probes, healthy: probes.every((p) => p.ok) };
}

async function checkCors(baseUrl: string): Promise<CorsCheck> {
  try {
    const res = await fetch(`${baseUrl}/api/public/v1/files`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://third-party.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "x-api-key",
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    const allowHeaders = res.headers.get("access-control-allow-headers");
    return {
      preflight_status: res.status,
      allow_origin: allowOrigin,
      allow_headers: allowHeaders,
      ok: res.status < 400 && Boolean(allowOrigin),
      error: null,
    };
  } catch (e) {
    return {
      preflight_status: null,
      allow_origin: null,
      allow_headers: null,
      ok: false,
      error: e instanceof Error ? e.message : "Preflight failed",
    };
  }
}

async function checkApiAuth(baseUrl: string, apiKey?: string): Promise<ApiAuthCheck> {
  const result: ApiAuthCheck = {
    invalid_key_rejected: false,
    invalid_key_status: null,
    json_error_envelope: false,
    provided_key_status: null,
    provided_key_ok: null,
    error: null,
  };
  try {
    const bad = await fetch(`${baseUrl}/api/public/v1/files`, {
      headers: { "X-API-Key": "eck_live_invalid_probe_key", Accept: "application/json" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    result.invalid_key_status = bad.status;
    result.invalid_key_rejected = bad.status === 401 || bad.status === 403;
    const text = await bad.text();
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      result.json_error_envelope = typeof parsed === "object" && parsed !== null && "error" in parsed;
    } catch {
      result.json_error_envelope = false;
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : "Request failed";
  }

  if (apiKey) {
    try {
      const good = await fetch(`${baseUrl}/api/public/v1/me`, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      result.provided_key_status = good.status;
      result.provided_key_ok = good.ok;
    } catch (e) {
      result.provided_key_ok = false;
      result.error = e instanceof Error ? e.message : "Request failed";
    }
  }
  return result;
}

async function checkSignedUrl(baseUrl: string, apiKey?: string): Promise<SignedUrlCheck> {
  if (!apiKey) {
    return { attempted: false, status: null, ok: false, expires_at: null, error: null };
  }
  try {
    const list = await fetch(`${baseUrl}/api/public/v1/files?limit=1`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!list.ok) {
      return {
        attempted: true,
        status: list.status,
        ok: false,
        expires_at: null,
        error: `Listing files returned ${list.status}`,
      };
    }
    const payload = (await list.json()) as { data?: Array<{ file_id?: string; id?: string }> };
    const first = payload.data?.[0];
    const fileId = first?.file_id ?? first?.id;
    if (!fileId) {
      return {
        attempted: true,
        status: 200,
        ok: false,
        expires_at: null,
        error: "No files available to sign",
      };
    }
    const signed = await fetch(`${baseUrl}/api/public/v1/files/${fileId}/signed-url`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ expires_in: 120 }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const body = (await signed.json().catch(() => null)) as
      | { data?: { expires_at?: string }; expires_at?: string }
      | null;
    const expiresAt = body?.data?.expires_at ?? body?.expires_at ?? null;
    return {
      attempted: true,
      status: signed.status,
      ok: signed.ok,
      expires_at: expiresAt,
      error: signed.ok ? null : `Signing returned ${signed.status}`,
    };
  } catch (e) {
    return {
      attempted: true,
      status: null,
      ok: false,
      expires_at: null,
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

/** Live probes of /health, /ready and /metrics on every official address. */
export const probeLiveTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const targets = await Promise.all(LIVE_TARGETS.map(probeTarget));
    return { targets, probed_at: new Date().toISOString() };
  });

/** Which managed bindings this server can see — names only, never values. */
export const getBindingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BindingStatus> => {
    await assertAdmin(context.userId);
    return readBindingStatus();
  });

export type VerificationSummary = {
  passed: boolean;
  missing_bindings: string[];
  bindings: BindingStatus;
  targets: Array<{
    target: LiveTarget;
    probes: ProbeResult[];
    healthy: boolean;
    cors: CorsCheck;
    api_auth: ApiAuthCheck;
    signed_url: SignedUrlCheck;
    serves_this_project: boolean;
  }>;
  ran_at: string;
  trigger_source: string;
};

async function runVerification(
  trigger: string,
  apiKey?: string,
): Promise<VerificationSummary> {
  const bindings = readBindingStatus();
  const targets = await Promise.all(
    LIVE_TARGETS.map(async (target) => {
      const [{ probes, healthy }, cors, api_auth, signed_url] = await Promise.all([
        probeTarget(target),
        checkCors(target.baseUrl),
        checkApiAuth(target.baseUrl, apiKey),
        checkSignedUrl(target.baseUrl, apiKey),
      ]);
      const health = probes.find((p) => p.path.endsWith("/health"));
      const servesThisProject =
        typeof health?.body === "object" &&
        health?.body !== null &&
        "database" in (health.body as Record<string, unknown>);
      return {
        target,
        probes,
        healthy,
        cors,
        api_auth,
        signed_url,
        serves_this_project: servesThisProject,
      };
    }),
  );
  const passed =
    bindings.ok &&
    targets.every((t) => t.healthy && t.cors.ok && t.api_auth.invalid_key_rejected);
  const summary: VerificationSummary = {
    passed,
    missing_bindings: bindings.missing_required,
    bindings,
    targets,
    ran_at: new Date().toISOString(),
    trigger_source: trigger,
  };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("deployment_verifications").insert({
      trigger_source: trigger,
      passed,
      missing_bindings: bindings.missing_required,
      results: JSON.parse(JSON.stringify(summary)) as JsonLike,
    });
  } catch {
    // Recording is best-effort; the live result still returns to the caller.
  }
  return summary;
}

/** Full verification of the official live domains (bindings + CORS + API auth + signed URLs). */
export const runDeploymentVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apiKey?: string; trigger?: string }) => d ?? {})
  .handler(async ({ data, context }): Promise<VerificationSummary> => {
    await assertAdmin(context.userId);
    const trigger = data.trigger === "post-publish" ? "post-publish" : "manual";
    const key = data.apiKey?.trim() || undefined;
    return runVerification(trigger, key);
  });

/** Runs a verification only when the last one is older than the given window. */
export const ensurePostPublishVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { maxAgeMinutes?: number; fingerprint?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const maxAge = Math.min(Math.max(data.maxAgeMinutes ?? 10, 1), 720);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: latest } = await supabaseAdmin
      .from("deployment_verifications")
      .select("id, created_at, passed, missing_bindings, results, trigger_source")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const fresh =
      latest && Date.now() - new Date(latest.created_at).getTime() < maxAge * 60 * 1000;
    if (fresh) {
      return { ran: false, record: latest as unknown as VerificationRecord };
    }
    const summary = await runVerification("post-publish");
    return { ran: true, summary };
  });

export const listVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VerificationRecord[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("deployment_verifications")
      .select("id, created_at, trigger_source, passed, missing_bindings, results")
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []) as unknown as VerificationRecord[];
  });

/** AI assistant: reads probe/binding evidence plus pasted logs and returns next steps. */
export const diagnosePlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { logs?: string }) => d ?? {})
  .handler(async ({ data, context }): Promise<{ analysis: string }> => {
    await assertAdmin(context.userId);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "The AI assistant is not configured yet: the LOVABLE_API_KEY binding is missing.",
      );
    }

    const bindings = readBindingStatus();
    const targets = await Promise.all(LIVE_TARGETS.map(probeTarget));
    const logs = (data.logs ?? "").slice(0, 12_000);

    const evidence = JSON.stringify(
      {
        bindings: {
          present: bindings.checked.filter((c) => c.present).map((c) => c.name),
          missing_required: bindings.missing_required,
          missing_optional: bindings.missing_optional,
        },
        live_probes: targets.map((t) => ({
          address: t.target.baseUrl,
          healthy: t.healthy,
          probes: t.probes.map((p) => ({
            path: p.path,
            status: p.status,
            error: p.error,
            body: p.body,
          })),
        })),
      },
      null,
      2,
    );

    const instructions = [
      "You are the EGREED Cloud platform diagnostician.",
      "Given binding presence (names only, no secret values), live probe results and server logs,",
      "identify exactly which managed environment variables are missing or unusable,",
      "explain what each missing one breaks, and give short, ordered, concrete next steps.",
      "Never invent variable names that are not in the evidence. Never ask for secret values.",
      "Answer in markdown: 'Diagnosis', 'Missing bindings', 'Next steps'.",
    ].join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "medium", summary: "auto" },
        input: [
          { role: "developer", content: [{ type: "input_text", text: instructions }] },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Evidence:\n${evidence}\n\nServer / API logs:\n${logs || "(none provided)"}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error("The AI assistant is busy right now. Try again in a moment.");
      }
      if (res.status === 402) {
        throw new Error("AI credits are exhausted. Add credits to continue using the assistant.");
      }
      throw new Error(`AI assistant failed (${res.status}). ${detail.slice(0, 300)}`);
    }

    // Read the SSE stream and accumulate the answer text.
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let reasoning = "";
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as { type?: string; delta?: string };
          if (evt.type === "response.output_text.delta" && evt.delta) answer += evt.delta;
          if (evt.type === "response.reasoning_summary_text.delta" && evt.delta)
            reasoning += evt.delta;
        } catch {
          // ignore malformed keep-alive frames
        }
      }
    }

    const analysis = answer.trim() || reasoning.trim();
    return {
      analysis:
        analysis ||
        "The assistant returned no text. Re-run the live probes and try the analysis again.",
    };
  });
