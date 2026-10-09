import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Play, Square, Trash2, Rocket, KeyRound, Copy, Github, ExternalLink, Activity,
  GitBranch, RotateCcw, LineChart as LineChartIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { generateApiKey, sha256Hex } from "@/lib/hash";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/ai/models/$slug")({
  head: () => ({ meta: [{ title: "Model — E-Cloud" }] }),
  component: ModelDetailPage,
  errorComponent: ({ error }) => <div className="p-10 text-destructive">Error: {error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div className="p-10 text-muted-foreground">Model not found.</div>,
});

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  building: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  running: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  stopped: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

function ModelDetailPage() {
  const { slug } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyRate, setKeyRate] = useState(60);
  const [keyQuota, setKeyQuota] = useState(1_000_000);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [newVersion, setNewVersion] = useState({ git_ref: "main", notes: "", config: "{}" });

  const { data: model } = useQuery({
    queryKey: ["ai-model", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_models").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: deployments = [] } = useQuery({
    queryKey: ["ai-deployments", model?.id],
    enabled: !!model,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_deployments")
        .select("*, ai_orchestrators(name, region, gpu_type)")
        .eq("model_id", model!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const activeDeployment = deployments.find((d) => d.status === "running" || d.status === "pending" || d.status === "building");

  const { data: events = [] } = useQuery({
    queryKey: ["ai-events", activeDeployment?.id],
    enabled: !!activeDeployment,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_deployment_events")
        .select("*")
        .eq("deployment_id", activeDeployment!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []).reverse();
    },
    refetchInterval: 3000,
  });

  const { data: orchestrators = [] } = useQuery({
    queryKey: ["ai-orchestrators-list"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_orchestrators").select("id,name,gpu_type,status");
      return data ?? [];
    },
  });

  const { data: keys = [] } = useQuery({
    queryKey: ["ai-keys", model?.id],
    enabled: !!model,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_gateway_keys")
        .select("id, name, prefix, model_id, owner_id, rate_limit_per_min, quota_tokens_month, tokens_used_month, quota_reset_at, created_at, revoked_at, last_used_at")
        .eq("model_id", model!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["ai-versions", model?.id],
    enabled: !!model,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_model_versions")
        .select("*")
        .eq("model_id", model!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["ai-metrics", activeDeployment?.id],
    enabled: !!activeDeployment,
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_metrics")
        .select("gpu_util, memory_used_mb, vram_used_mb, tokens_per_sec, measured_at")
        .eq("deployment_id", activeDeployment!.id)
        .order("measured_at", { ascending: false })
        .limit(120);
      return (data ?? []).reverse().map((m) => ({
        t: new Date(m.measured_at).toLocaleTimeString(),
        gpu: m.gpu_util != null ? Number(m.gpu_util) : null,
        mem: m.memory_used_mb ?? null,
        vram: m.vram_used_mb ?? null,
        tps: m.tokens_per_sec != null ? Number(m.tokens_per_sec) : null,
      }));
    },
    refetchInterval: 3000,
  });

  const deploy = useMutation({
    mutationFn: async (versionId?: string) => {
      if (!model) return;
      const runner = orchestrators.find((o) => o.status === "online") ?? orchestrators[0];
      const version = versionId
        ? versions.find((v) => v.id === versionId)
        : versions.find((v) => v.is_active) ?? versions[0];
      const { data: dep, error } = await supabase
        .from("ai_deployments")
        .insert({
          model_id: model.id,
          orchestrator_id: runner?.id ?? null,
          version_id: version?.id ?? null,
          status: "pending",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      // Mark selected version as active
      if (version) {
        await supabase.from("ai_model_versions").update({ is_active: false }).eq("model_id", model.id);
        await supabase.from("ai_model_versions").update({ is_active: true }).eq("id", version.id);
      }
      await supabase.from("ai_models").update({ status: "building" }).eq("id", model.id);
      await supabase.from("ai_deployment_events").insert([
        { deployment_id: dep.id, level: "info", message: `Queued deployment for ${model.name}${version ? ` @ ${version.git_ref}` : ""}` },
        { deployment_id: dep.id, level: "info", message: runner ? `Assigned to runner "${runner.name}"` : "No GPU runner registered — job will remain pending until one is added" },
      ]);
    },
    onSuccess: () => {
      toast.success("Deployment queued");
      qc.invalidateQueries({ queryKey: ["ai-deployments"] });
      qc.invalidateQueries({ queryKey: ["ai-versions"] });
      qc.invalidateQueries({ queryKey: ["ai-model", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const stop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_deployments")
        .update({ status: "stopped", stopped_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("ai_deployment_events").insert({
        deployment_id: id, level: "warn", message: "Stop requested from control plane",
      });
      if (model) await supabase.from("ai_models").update({ status: "stopped" }).eq("id", model.id);
    },
    onSuccess: () => {
      toast.success("Deployment stopped");
      qc.invalidateQueries({ queryKey: ["ai-deployments"] });
      qc.invalidateQueries({ queryKey: ["ai-model", slug] });
    },
  });

  const deleteModel = useMutation({
    mutationFn: async () => {
      if (!model) return;
      const { error } = await supabase.from("ai_models").delete().eq("id", model.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Model deleted");
      navigate({ to: "/ai/models" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createKey = useMutation({
    mutationFn: async () => {
      if (!model || !keyName.trim()) throw new Error("Name required");
      const key = generateApiKey();
      const key_hash = await sha256Hex(key);
      const { error } = await supabase.from("ai_gateway_keys").insert({
        owner_id: user!.id,
        model_id: model.id,
        name: keyName.trim(),
        prefix: key.slice(0, 16),
        key_hash,
        rate_limit_per_min: Math.max(1, Number(keyRate) || 60),
        quota_tokens_month: Math.max(0, Number(keyQuota) || 1_000_000),
      });
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      setCreatedKey(key);
      setKeyName("");
      setKeyOpen(false);
      qc.invalidateQueries({ queryKey: ["ai-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_gateway_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Key revoked");
      qc.invalidateQueries({ queryKey: ["ai-keys"] });
    },
  });

  const createVersion = useMutation({
    mutationFn: async () => {
      if (!model || !newVersion.git_ref.trim()) throw new Error("Git ref required");
      let config: unknown = {};
      try { config = JSON.parse(newVersion.config || "{}"); } catch { throw new Error("Config must be valid JSON"); }
      const { error } = await supabase.from("ai_model_versions").insert({
        model_id: model.id,
        git_ref: newVersion.git_ref.trim(),
        source_repo: model.source_repo,
        deployment_config: config as never,
        notes: newVersion.notes || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Version created");
      setVersionOpen(false);
      setNewVersion({ git_ref: "main", notes: "", config: "{}" });
      qc.invalidateQueries({ queryKey: ["ai-versions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!model) return <div className="p-10 text-muted-foreground">Loading…</div>;

  const canDeploy = model.status !== "building" && !activeDeployment;

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <Link to="/ai/models" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to models
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{model.name}</h1>
            <Badge className={STATUS_TONE[model.status] ?? STATUS_TONE.draft}>{model.status}</Badge>
          </div>
          {model.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{model.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {model.source_repo && (
              <a
                href={`https://github.com/${model.source_repo}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Github className="h-3.5 w-3.5" /> {model.source_repo}
                {model.source_ref && <span className="text-muted-foreground/70">@{model.source_ref}</span>}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {model.framework && <span className="rounded bg-muted px-1.5 py-0.5">{model.framework}</span>}
            {model.gpu_type && <span className="rounded bg-muted px-1.5 py-0.5">{model.gpu_type}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {canDeploy ? (
            <Button className="gap-2" onClick={() => deploy.mutate(undefined)} disabled={deploy.isPending}>
              <Play className="h-4 w-4" /> Deploy
            </Button>
          ) : activeDeployment ? (
            <Button variant="outline" className="gap-2" onClick={() => stop.mutate(activeDeployment.id)}>
              <Square className="h-4 w-4" /> Stop
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={() => deleteModel.mutate()} aria-label="Delete model">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Deployments</h2>
              </div>
              <span className="text-xs text-muted-foreground">{deployments.length} total</span>
            </div>
            {deployments.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No deployments yet. Hit <b>Deploy</b> to queue one on your GPU runner.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Runner</th>
                    <th className="px-4 py-3">GPU util</th>
                    <th className="px-4 py-3">Memory</th>
                    <th className="px-4 py-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <Badge className={STATUS_TONE[d.status] ?? STATUS_TONE.draft}>{d.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.ai_orchestrators?.name ?? <span className="italic">unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.gpu_util != null ? `${Number(d.gpu_util).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.memory_used_mb ? `${d.memory_used_mb} MB` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.started_at ? formatDate(d.started_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">GPU metrics</h2>
              </div>
              <span className="text-xs text-muted-foreground">{metrics.length} samples</span>
            </div>
            {metrics.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Waiting for the runner to stream metrics.
              </div>
            ) : (
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <MetricChart data={metrics} dataKey="gpu" label="GPU util (%)" unit="%" stroke="hsl(var(--primary))" />
                <MetricChart data={metrics} dataKey="tps" label="Tokens / sec" stroke="#10b981" />
                <MetricChart data={metrics} dataKey="mem" label="Memory (MB)" unit=" MB" stroke="#f59e0b" />
                <MetricChart data={metrics} dataKey="vram" label="VRAM (MB)" unit=" MB" stroke="#8b5cf6" />
              </div>
            )}
          </Card>



          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Live logs</h2>
              </div>
              {activeDeployment && <span className="text-xs text-muted-foreground">deployment {activeDeployment.id.slice(0, 8)}</span>}
            </div>
            <div className="max-h-80 overflow-y-auto bg-surface-2 p-4 font-mono text-xs">
              {events.length === 0 ? (
                <div className="text-muted-foreground">No log lines yet. The GPU runner streams events here.</div>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="flex gap-3 py-0.5">
                    <span className="shrink-0 text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                    <span className={`shrink-0 uppercase ${
                      e.level === "error" ? "text-destructive" :
                      e.level === "warn" ? "text-amber-500" :
                      "text-muted-foreground"
                    }`}>{e.level}</span>
                    <span className="whitespace-pre-wrap break-all">{e.message}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold">Endpoint</h2>
            <p className="mt-1 text-xs text-muted-foreground">Once running, call this via HTTPS with an API key below.</p>
            <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs">
              POST {model.endpoint_path}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Gateway keys</h2>
              </div>
              <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">+ Key</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create gateway key</DialogTitle>
                    <DialogDescription>This key can only call {model.name}.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label>Name</Label>
                      <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Mobile app" autoFocus />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label>Rate limit (req/min)</Label>
                        <Input type="number" min={1} value={keyRate} onChange={(e) => setKeyRate(Number(e.target.value))} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Monthly token quota</Label>
                        <Input type="number" min={0} value={keyQuota} onChange={(e) => setKeyQuota(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setKeyOpen(false)}>Cancel</Button>
                    <Button onClick={() => createKey.mutate()} disabled={createKey.isPending}>Generate</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {keys.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No keys yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {keys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{k.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{k.prefix}…</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => revokeKey.mutate(k.id)} aria-label="Revoke">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Versions</h2>
              </div>
              <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">+ Version</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New version</DialogTitle>
                    <DialogDescription>Pin a specific branch, tag, or commit — then deploy or roll back.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label>Git ref (branch / tag / SHA)</Label>
                      <Input value={newVersion.git_ref} onChange={(e) => setNewVersion({ ...newVersion, git_ref: e.target.value })} placeholder="v1.2.0 or abc123" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Notes</Label>
                      <Input value={newVersion.notes} onChange={(e) => setNewVersion({ ...newVersion, notes: e.target.value })} placeholder="What changed" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Deployment config (JSON)</Label>
                      <Textarea rows={4} className="font-mono text-xs" value={newVersion.config} onChange={(e) => setNewVersion({ ...newVersion, config: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setVersionOpen(false)}>Cancel</Button>
                    <Button onClick={() => createVersion.mutate()} disabled={createVersion.isPending}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {versions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No versions yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="truncate font-mono text-xs">{v.git_ref}</code>
                        {v.is_active && <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">active</Badge>}
                      </div>
                      {v.notes && <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{v.notes}</div>}
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(v.created_at)}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={v.is_active ? "ghost" : "outline"}
                      className="gap-1.5"
                      disabled={deploy.isPending || !!activeDeployment}
                      onClick={() => deploy.mutate(v.id)}
                      title={v.is_active ? "Redeploy" : "Rollback"}
                    >
                      {v.is_active ? <Play className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
                      {v.is_active ? "Deploy" : "Rollback"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>


      <Dialog open={!!createdKey} onOpenChange={(o) => !o && setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new gateway key</DialogTitle>
            <DialogDescription>Copy it now — it can't be shown again.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <code className="break-all font-mono text-sm">{createdKey}</code>
          </div>
          <DialogFooter>
            <Button className="gap-2" onClick={() => {
              if (createdKey) { navigator.clipboard.writeText(createdKey); toast.success("Copied"); }
              setCreatedKey(null);
            }}>
              <Copy className="h-4 w-4" /> Copy & close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type MetricPoint = { t: string; gpu: number | null; mem: number | null; vram: number | null; tps: number | null };

function MetricChart({ data, dataKey, label, unit = "", stroke }: {
  data: MetricPoint[];
  dataKey: "gpu" | "mem" | "vram" | "tps";
  label: string;
  unit?: string;
  stroke: string;
}) {
  const latest = [...data].reverse().find((d) => d[dataKey] != null)?.[dataKey];
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs font-semibold">
          {latest != null ? `${Number(latest).toFixed(dataKey === "gpu" || dataKey === "tps" ? 1 : 0)}${unit}` : "—"}
        </span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} width={40} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
              formatter={(v: number) => [`${v}${unit}`, label]}
            />
            <Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

