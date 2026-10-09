// Shared (client-safe) types and constants for platform health probing,
// endpoint testing and post-publish verification.

export type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

export type LiveTarget = {
  id: string;
  label: string;
  baseUrl: string;
  official: boolean;
};

/** The addresses that must serve this project's build. */
export const LIVE_TARGETS: LiveTarget[] = [
  {
    id: "custom",
    label: "cloud.egreedtech.org",
    baseUrl: "https://cloud.egreedtech.org",
    official: true,
  },
  {
    id: "lovable",
    label: "e-cloude.lovable.app",
    baseUrl: "https://e-cloude.lovable.app",
    official: false,
  },
];

export const PROBE_PATHS = [
  "/api/public/v1/health",
  "/api/public/v1/ready",
  "/api/public/v1/metrics",
] as const;

export type ProbePath = (typeof PROBE_PATHS)[number];

export type ProbeResult = {
  path: string;
  url: string;
  ok: boolean;
  status: number | null;
  duration_ms: number;
  /** Parsed JSON body when the endpoint answered with JSON. */
  body: JsonLike;
  content_type: string | null;
  error: string | null;
};

export type TargetProbe = {
  target: LiveTarget;
  probes: ProbeResult[];
  healthy: boolean;
};

export type BindingCheck = {
  name: string;
  present: boolean;
  required: boolean;
  used_for: string;
};

export type BindingStatus = {
  checked: BindingCheck[];
  missing_required: string[];
  missing_optional: string[];
  ok: boolean;
  checked_at: string;
};

export type ApiAuthCheck = {
  invalid_key_rejected: boolean;
  invalid_key_status: number | null;
  json_error_envelope: boolean;
  provided_key_status: number | null;
  provided_key_ok: boolean | null;
  error: string | null;
};

export type SignedUrlCheck = {
  attempted: boolean;
  status: number | null;
  ok: boolean;
  expires_at: string | null;
  error: string | null;
};

export type CorsCheck = {
  preflight_status: number | null;
  allow_origin: string | null;
  allow_headers: string | null;
  ok: boolean;
  error: string | null;
};

export type VerificationRecord = {
  id: string;
  created_at: string;
  trigger_source: string;
  passed: boolean;
  missing_bindings: string[];
  results: JsonLike;
};

/** Fingerprint of the running client bundle, used to detect a new publish. */
export function clientBuildFingerprint(): string {
  if (typeof document === "undefined") return "ssr";
  const scripts = Array.from(document.querySelectorAll("script[src]"))
    .map((s) => (s as HTMLScriptElement).src)
    .filter((src) => src.includes("/assets/"))
    .sort();
  return scripts.length ? scripts[scripts.length - 1] : "unknown";
}
