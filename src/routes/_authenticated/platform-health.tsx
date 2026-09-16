import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { LIVE_TARGETS, PROBE_PATHS, clientBuildFingerprint } from "@/lib/platform-health";
import {
  diagnosePlatform,
  ensurePostPublishVerification,
  getBindingStatus,
  listVerifications,
  probeLiveTargets,
  runDeploymentVerification,
} from "@/lib/platform-health.functions";
import {
  listOwnFilesForCheck,
  runExternalAppSmokeTest,
  verifySignedDownload,
  type CheckStep,
} from "@/lib/platform-smoke.functions";

export const Route = createFileRoute("/_authenticated/platform-health")({
  head: () => ({
    meta: [
      { title: "Platform Health & Live Checks — E-Cloud" },
      {
        name: "description",
        content:
          "Live health, readiness and metrics probes, missing configuration by name, an endpoint tester and AI-assisted diagnosis for EGREED Cloud.",
      },
      { property: "og:title", content: "Platform Health & Live Checks — E-Cloud" },
      {
        property: "og:description",
        content:
          "Probe the live EGREED Cloud addresses, test API keys, signed links and CORS, and get AI-assisted fixes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: PlatformHealthPage,
});

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge variant={ok ? "default" : "destructive"} className="gap-1">
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

function StepList({ steps }: { steps: CheckStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div
          key={`${s.name}-${i}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
        >
          <div>
            <div className="font-medium">{s.name}</div>
            <div className="text-muted-foreground text-xs">{s.detail}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{s.duration_ms} ms</span>
            <StatusPill ok={s.ok} label={s.status ? String(s.status) : s.ok ? "ok" : "failed"} />
          </div>
        </div>
      ))}
    </div>
  );
}

type BrowserCheck = {
  target: string;
  probe: { path: string; status: number | null; ok: boolean; error: string | null }[];
  cors: { ok: boolean; detail: string };
  apiKey: { ok: boolean | null; detail: string };
  signed: { ok: boolean | null; detail: string };
};

function PlatformHealthPage() {
  const qc = useQueryClient();
  const probe = useServerFn(probeLiveTargets);
  const bindings = useServerFn(getBindingStatus);
  const verify = useServerFn(runDeploymentVerification);
  const autoVerify = useServerFn(ensurePostPublishVerification);
  const history = useServerFn(listVerifications);
  const diagnose = useServerFn(diagnosePlatform);

  const ownFiles = useServerFn(listOwnFilesForCheck);
  const signedCheck = useServerFn(verifySignedDownload);
  const smokeTest = useServerFn(runExternalAppSmokeTest);

  const [selectedFile, setSelectedFile] = useState("");
  const [targetId, setTargetId] = useState(LIVE_TARGETS[0].id);
  const [apiKey, setApiKey] = useState("");
  const [foreignApiKey, setForeignApiKey] = useState("");
  const [logs, setLogs] = useState("");
  const [browserResults, setBrowserResults] = useState<BrowserCheck[]>([]);
  const [testing, setTesting] = useState(false);
  const autoRan = useRef(false);

  const probeQuery = useQuery({
    queryKey: ["platform-probes"],
    queryFn: () => probe({ data: undefined }),
    refetchInterval: 60_000,
  });

  const bindingQuery = useQuery({
    queryKey: ["platform-bindings"],
    queryFn: () => bindings({ data: undefined }),
  });

  const historyQuery = useQuery({
    queryKey: ["platform-verifications"],
    queryFn: () => history({ data: undefined }),
  });

  // Automated post-publish verification: when a newly published bundle is
  // being served, re-test the official live domains (at most once per window).
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const fingerprint = clientBuildFingerprint();
    const previous = window.localStorage.getItem("egreed:build-fingerprint");
    const changed = previous !== fingerprint;
    window.localStorage.setItem("egreed:build-fingerprint", fingerprint);
    autoVerify({ data: { maxAgeMinutes: changed ? 1 : 30, fingerprint } })
      .then((res) => {
        if (res.ran) {
          qc.invalidateQueries({ queryKey: ["platform-verifications"] });
          toast.success("Post-publish verification finished");
        }
      })
      .catch(() => {});
  }, [autoVerify, qc]);

  const verifyMutation = useMutation({
    mutationFn: () => verify({ data: { apiKey: apiKey.trim() || undefined } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["platform-verifications"] });
      res.passed
        ? toast.success("All live checks passed")
        : toast.error("Some live checks failed — see results");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const diagnoseMutation = useMutation({
    mutationFn: () => diagnose({ data: { logs } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filesQuery = useQuery({
    queryKey: ["platform-own-files"],
    queryFn: () => ownFiles({ data: undefined }),
  });

  const signedMutation = useMutation({
    mutationFn: () =>
      signedCheck({
        data: {
          fileId: selectedFile,
          targetId,
          apiKey: apiKey.trim() || undefined,
          foreignApiKey: foreignApiKey.trim() || undefined,
        },
      }),
    onSuccess: (res) =>
      res.passed
        ? toast.success("Secure link works from outside the app")
        : toast.error("The external download check found a problem"),
    onError: (e: Error) => toast.error(e.message),
  });

  const smokeMutation = useMutation({
    mutationFn: () => smokeTest({ data: { apiKey: apiKey.trim(), targetId } }),
    onSuccess: (res) =>
      res.passed
        ? toast.success("External app smoke test passed")
        : toast.error("Some smoke test steps failed"),
    onError: (e: Error) => toast.error(e.message),
  });

  async function runBrowserTests() {
    setTesting(true);
    const key = apiKey.trim();
    const out: BrowserCheck[] = [];
    for (const target of LIVE_TARGETS) {
      const probes: BrowserCheck["probe"] = [];
      for (const path of PROBE_PATHS) {
        try {
          const res = await fetch(`${target.baseUrl}${path}`, { headers: { Accept: "application/json" } });
          probes.push({ path, status: res.status, ok: res.ok, error: null });
        } catch (e) {
          probes.push({
            path,
            status: null,
            ok: false,
            error: e instanceof Error ? e.message : "Blocked",
          });
        }
      }

      let cors: BrowserCheck["cors"] = { ok: false, detail: "Not reached" };
      try {
        const res = await fetch(`${target.baseUrl}/api/public/v1/files`, {
          headers: { "X-API-Key": key || "eck_live_invalid_probe_key" },
        });
        cors = {
          ok: true,
          detail: `Cross-origin request allowed (status ${res.status})`,
        };
      } catch (e) {
        cors = {
          ok: false,
          detail: e instanceof Error ? `Blocked by the browser: ${e.message}` : "Blocked",
        };
      }

      let apiKeyCheck: BrowserCheck["apiKey"] = { ok: null, detail: "No key provided" };
      let signed: BrowserCheck["signed"] = { ok: null, detail: "No key provided" };
      if (key) {
        try {
          const res = await fetch(`${target.baseUrl}/api/public/v1/me`, {
            headers: { "X-API-Key": key },
          });
          apiKeyCheck = {
            ok: res.ok,
            detail: res.ok ? "Key accepted, account resolved" : `Rejected with status ${res.status}`,
          };
        } catch (e) {
          apiKeyCheck = { ok: false, detail: e instanceof Error ? e.message : "Failed" };
        }
        try {
          const list = await fetch(`${target.baseUrl}/api/public/v1/files?limit=1`, {
            headers: { "X-API-Key": key },
          });
          const payload = (await list.json().catch(() => null)) as {
            data?: Array<{ file_id?: string; id?: string }>;
          } | null;
          const fileId = payload?.data?.[0]?.file_id ?? payload?.data?.[0]?.id;
          if (!fileId) {
            signed = { ok: null, detail: "No files available to sign" };
          } else {
            const res = await fetch(`${target.baseUrl}/api/public/v1/files/${fileId}/signed-url`, {
              method: "POST",
              headers: { "X-API-Key": key, "Content-Type": "application/json" },
              body: JSON.stringify({ expires_in: 120 }),
            });
            const body = (await res.json().catch(() => null)) as {
              data?: { expires_at?: string };
              expires_at?: string;
            } | null;
            const expires = body?.data?.expires_at ?? body?.expires_at ?? null;
            signed = {
              ok: res.ok,
              detail: res.ok
                ? `Secure link created${expires ? `, expires ${formatDate(expires)}` : ""}`
                : `Failed with status ${res.status}`,
            };
          }
        } catch (e) {
          signed = { ok: false, detail: e instanceof Error ? e.message : "Failed" };
        }
      }
      out.push({ target: target.label, probe: probes, cors, apiKey: apiKeyCheck, signed });
    }
    setBrowserResults(out);
    setTesting(false);
  }

  const bindingData = bindingQuery.data;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Activity className="h-6 w-6" /> Platform health &amp; live checks
        </h1>
        <p className="text-muted-foreground text-sm">
          Live status of the official addresses, missing configuration by name, an endpoint tester,
          and AI-assisted next steps. Configuration values are never shown.
        </p>
      </header>

      <Tabs defaultValue="probes">
        <TabsList>
          <TabsTrigger value="probes">Live probes</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="tester">Endpoint tester</TabsTrigger>
          <TabsTrigger value="signed">Secure link check</TabsTrigger>
          <TabsTrigger value="smoke">External app test</TabsTrigger>
          <TabsTrigger value="verify">Verification</TabsTrigger>
          <TabsTrigger value="assistant">AI assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="probes" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => probeQuery.refetch()}
              disabled={probeQuery.isFetching}
            >
              {probeQuery.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
          {probeQuery.data?.targets.map((t) => (
            <Card key={t.target.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.target.label}</div>
                <StatusPill ok={t.healthy} label={t.healthy ? "Healthy" : "Problem"} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {t.probes.map((p) => (
                  <div key={p.path} className="rounded-md border p-3 text-sm">
                    <div className="font-mono text-xs">{p.path.replace("/api/public/v1", "")}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusPill ok={p.ok} label={p.status ? String(p.status) : "no answer"} />
                      <span className="text-muted-foreground text-xs">{p.duration_ms} ms</span>
                    </div>
                    {p.error && <div className="text-destructive mt-1 text-xs">{p.error}</div>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {probeQuery.isLoading && (
            <p className="text-muted-foreground text-sm">Checking the live addresses…</p>
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-4 pt-4">
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-medium">Managed configuration</span>
              {bindingData && (
                <StatusPill
                  ok={bindingData.ok}
                  label={bindingData.ok ? "Complete" : `${bindingData.missing_required.length} missing`}
                />
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Only names and whether each one is available are shown here — never the values.
            </p>
            <div className="space-y-2">
              {bindingData?.checked.map((c) => (
                <div
                  key={c.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <div className="font-mono text-sm">{c.name}</div>
                    <div className="text-muted-foreground text-xs">{c.used_for}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!c.required && <Badge variant="secondary">optional</Badge>}
                    <StatusPill ok={c.present} label={c.present ? "Available" : "Missing"} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tester" className="space-y-4 pt-4">
          <Card className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API key (optional)</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="eck_live_…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Used only for this test in your browser. It is not saved.
              </p>
            </div>
            <Button onClick={runBrowserTests} disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Test both addresses from this browser
            </Button>
            {browserResults.map((r) => (
              <div key={r.target} className="space-y-2 rounded-md border p-3">
                <div className="font-medium">{r.target}</div>
                <div className="flex flex-wrap gap-2">
                  {r.probe.map((p) => (
                    <StatusPill
                      key={p.path}
                      ok={p.ok}
                      label={`${p.path.split("/").pop()} ${p.status ?? "—"}`}
                    />
                  ))}
                </div>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Cross-origin access: </span>
                    {r.cors.detail}
                  </div>
                  <div>
                    <span className="font-medium">API key: </span>
                    {r.apiKey.detail}
                  </div>
                  <div>
                    <span className="font-medium">Secure link: </span>
                    {r.signed.detail}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="signed" className="space-y-4 pt-4">
          <Card className="space-y-4 p-4">
            <div>
              <div className="font-medium">Secure download link from outside the app</div>
              <p className="text-muted-foreground text-sm">
                Creates a time-limited link for one of your files and then downloads it as an
                outside caller would, checking the contents arrive and that a tampered link fails.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signed-file">File</Label>
                <select
                  id="signed-file"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                >
                  <option value="">Choose a file…</option>
                  {(filesQuery.data ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.locked ? "(locked)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signed-target">Address</Label>
                <select
                  id="signed-target"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  {LIVE_TARGETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signed-key">API key (optional — uses the public API when given)</Label>
                <Input
                  id="signed-key"
                  type="password"
                  placeholder="eck_live_…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signed-foreign-key">
                  Key from another organization (optional — isolation check)
                </Label>
                <Input
                  id="signed-foreign-key"
                  type="password"
                  placeholder="eck_live_…"
                  value={foreignApiKey}
                  onChange={(e) => setForeignApiKey(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={() => signedMutation.mutate()}
              disabled={!selectedFile || signedMutation.isPending}
            >
              {signedMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Check external access
            </Button>
            {signedMutation.data && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    ok={signedMutation.data.passed}
                    label={signedMutation.data.passed ? "Accessible" : "Problem found"}
                  />
                  <span className="text-muted-foreground text-sm">
                    {signedMutation.data.file_name} · {signedMutation.data.target_label}
                    {signedMutation.data.expires_at
                      ? ` · expires ${formatDate(signedMutation.data.expires_at)}`
                      : ""}
                  </span>
                </div>

                {signedMutation.data.expiry && (
                  <Card className="bg-muted/30 space-y-2 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Expiry behaviour</span>
                      <StatusPill
                        ok={signedMutation.data.expiry.expired_refused}
                        label={
                          {
                            refused_at_expiry: "expired exactly on time",
                            refused_after_grace: "expired after a short grace",
                            never_expired: "never expired",
                            inconclusive: "inconclusive",
                          }[signedMutation.data.expiry.observed]
                        }
                      />
                      {signedMutation.data.expiry.grace_exercised && (
                        <span className="text-muted-foreground text-xs">grace path exercised</span>
                      )}
                    </div>
                    <dl className="text-muted-foreground grid gap-1 sm:grid-cols-2">
                      <div>
                        Test link lifetime: {signedMutation.data.expiry.ttl_seconds}s (issued{" "}
                        {formatDate(signedMutation.data.expiry.issued_at)})
                      </div>
                      <div>
                        Expected to expire at:{" "}
                        {formatDate(signedMutation.data.expiry.expected_expiry_at)}
                      </div>
                      <div>
                        Immediately after issuing:{" "}
                        {signedMutation.data.expiry.fresh_ok ? "worked" : "refused"} (status{" "}
                        {signedMutation.data.expiry.fresh_status ?? "none"})
                      </div>
                      <div>
                        Grace probe (+{signedMutation.data.expiry.grace_offset_ms}ms):{" "}
                        {signedMutation.data.expiry.grace_exercised
                          ? "still accepted — within clock tolerance"
                          : "already refused"}{" "}
                        (status {signedMutation.data.expiry.grace_status ?? "none"})
                      </div>
                      <div>
                        After the timeout ({formatDate(signedMutation.data.expiry.expired_probe_at)}
                        ): {signedMutation.data.expiry.expired_refused ? "refused" : "still worked"}{" "}
                        (status {signedMutation.data.expiry.expired_status ?? "none"})
                      </div>
                      <div>Requested link lifetime: {signedMutation.data.requested_expires_in}s</div>
                    </dl>
                  </Card>
                )}

                {signedMutation.data.integrity && (
                  <Card className="bg-muted/30 space-y-2 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Contents &amp; headers</span>
                      <StatusPill
                        ok={signedMutation.data.integrity.checksum_match}
                        label={signedMutation.data.integrity.checksum_match ? "identical" : "differs"}
                      />
                      <StatusPill
                        ok={
                          signedMutation.data.integrity.content_type_ok &&
                          signedMutation.data.integrity.disposition_ok
                        }
                        label="headers"
                      />
                    </div>
                    <dl className="text-muted-foreground grid gap-1 sm:grid-cols-2">
                      <div>
                        Size: {signedMutation.data.integrity.received_bytes} of{" "}
                        {signedMutation.data.integrity.expected_bytes} bytes
                      </div>
                      <div className="break-all">
                        Checksum: {signedMutation.data.integrity.received_sha256?.slice(0, 24) ?? "—"}…
                      </div>
                      <div>
                        Type: {signedMutation.data.integrity.content_type ?? "missing"}
                        {signedMutation.data.integrity.expected_mime
                          ? ` (expected ${signedMutation.data.integrity.expected_mime})`
                          : ""}
                      </div>
                      <div className="break-all">
                        Filename header: {signedMutation.data.integrity.content_disposition ?? "missing"}
                      </div>
                    </dl>
                  </Card>
                )}

                {signedMutation.data.isolation && (
                  <Card className="bg-muted/30 space-y-1 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Organization isolation</span>
                      <StatusPill
                        ok={signedMutation.data.isolation.blocked}
                        label={signedMutation.data.isolation.blocked ? "blocked" : "not blocked"}
                      />
                    </div>
                    <p className="text-muted-foreground">
                      {signedMutation.data.isolation.other_owner_label
                        ? `Second key: ${signedMutation.data.isolation.other_owner_label}. `
                        : ""}
                      {signedMutation.data.isolation.detail}
                    </p>
                  </Card>
                )}

                <StepList steps={signedMutation.data.steps} />
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="smoke" className="space-y-4 pt-4">
          <Card className="space-y-4 p-4">
            <div>
              <div className="font-medium">External app smoke test</div>
              <p className="text-muted-foreground text-sm">
                Acts like a third-party app: uploads a tiny text file, lists it, downloads it from
                an outside address, deletes it again, and confirms cross-origin access and key
                permissions. Nothing is left behind.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smoke-key">API key</Label>
                <Input
                  id="smoke-key"
                  type="password"
                  placeholder="eck_live_…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smoke-target">Address</Label>
                <select
                  id="smoke-target"
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  {LIVE_TARGETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              The key needs upload, read, download and manage permissions for every step to pass.
            </p>
            <Button
              onClick={() => smokeMutation.mutate()}
              disabled={!apiKey.trim() || smokeMutation.isPending}
            >
              {smokeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Run smoke test
            </Button>
            {smokeMutation.data && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    ok={smokeMutation.data.passed}
                    label={smokeMutation.data.passed ? "All steps passed" : "Some steps failed"}
                  />
                  <span className="text-muted-foreground text-sm">
                    {smokeMutation.data.target_label} · {formatDate(smokeMutation.data.ran_at)}
                  </span>
                </div>
                <StepList steps={smokeMutation.data.steps} />
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="verify" className="space-y-4 pt-4">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">Live domain verification</div>
                <p className="text-muted-foreground text-sm">
                  Runs automatically after a new version is published, and any time you ask.
                </p>
              </div>
              <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Run verification now
              </Button>
            </div>
            {verifyMutation.data && (
              <div className="space-y-2">
                <StatusPill
                  ok={verifyMutation.data.passed}
                  label={verifyMutation.data.passed ? "Passed" : "Failed"}
                />
                {verifyMutation.data.targets.map((t) => (
                  <div key={t.target.id} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{t.target.label}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusPill ok={t.healthy} label="probes" />
                      <StatusPill ok={t.cors.ok} label="cross-origin" />
                      <StatusPill ok={t.api_auth.invalid_key_rejected} label="key checks enforced" />
                      <StatusPill ok={t.serves_this_project} label="serving this project" />
                      {t.signed_url.attempted && (
                        <StatusPill ok={t.signed_url.ok} label="secure links" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <div className="text-sm font-medium">Recent runs</div>
              {(historyQuery.data ?? []).map((v) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <span>{formatDate(v.created_at)}</span>
                  <span className="text-muted-foreground">{v.trigger_source}</span>
                  <span className="text-muted-foreground text-xs">
                    {v.missing_bindings.length
                      ? `missing: ${v.missing_bindings.join(", ")}`
                      : "configuration complete"}
                  </span>
                  <StatusPill ok={v.passed} label={v.passed ? "Passed" : "Failed"} />
                </div>
              ))}
              {historyQuery.data?.length === 0 && (
                <p className="text-muted-foreground text-sm">No runs recorded yet.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="assistant" className="space-y-4 pt-4">
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-medium">AI diagnosis</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Paste any API or server errors you are seeing. The assistant combines them with the
              live probe results and tells you exactly what is missing and what to do next.
            </p>
            <Textarea
              rows={6}
              placeholder="Paste error output or logs here (optional)…"
              value={logs}
              onChange={(e) => setLogs(e.target.value)}
            />
            <Button onClick={() => diagnoseMutation.mutate()} disabled={diagnoseMutation.isPending}>
              {diagnoseMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Analyze
            </Button>
            {diagnoseMutation.data && (
              <pre className="bg-muted max-h-[420px] overflow-auto rounded-md p-3 text-sm whitespace-pre-wrap">
                {diagnoseMutation.data.analysis}
              </pre>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
