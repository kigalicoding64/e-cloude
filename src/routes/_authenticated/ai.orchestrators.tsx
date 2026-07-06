import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Plus, Trash2, Radio, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ai/orchestrators")({
  head: () => ({ meta: [{ title: "GPU Runners — E-Cloud" }] }),
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
  component: OrchestratorsPage,
});

const STATUS_TONE: Record<string, string> = {
  online: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  offline: "bg-destructive/15 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

function OrchestratorsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    base_url: "",
    region: "",
    gpu_type: "A100",
    status: "unknown",
  });

  const { data: runners = [] } = useQuery({
    queryKey: ["orchestrators"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_orchestrators")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.base_url.trim()) throw new Error("Name and URL required");
      const { error } = await supabase.from("ai_orchestrators").insert({
        name: form.name.trim(),
        base_url: form.base_url.trim(),
        region: form.region || null,
        gpu_type: form.gpu_type,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("GPU runner registered");
      setOpen(false);
      setForm({ ...form, name: "", base_url: "", region: "" });
      qc.invalidateQueries({ queryKey: ["orchestrators"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_orchestrators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Runner removed");
      qc.invalidateQueries({ queryKey: ["orchestrators"] });
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">GPU runners</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Register the external orchestrator agents that actually run containerized model deployments.
            Each runner exposes a base URL that the control plane calls to build & launch jobs.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Register runner</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register a GPU runner</DialogTitle>
              <DialogDescription>An external agent on a GPU host that accepts deployment jobs from E-Cloud.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. eu-west-a100-01" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Base URL</Label>
                <Input placeholder="https://runner.example.com" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Region</Label>
                  <Input placeholder="eu-west-1" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>GPU type</Label>
                  <Select value={form.gpu_type} onValueChange={(v) => setForm({ ...form, gpu_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPU">CPU only</SelectItem>
                      <SelectItem value="T4">NVIDIA T4</SelectItem>
                      <SelectItem value="L4">NVIDIA L4</SelectItem>
                      <SelectItem value="A10G">NVIDIA A10G</SelectItem>
                      <SelectItem value="A100">NVIDIA A100</SelectItem>
                      <SelectItem value="H100">NVIDIA H100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Initial status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>Register</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {runners.length === 0 ? (
        <Card className="p-16 text-center">
          <Server className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No GPU runners registered yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Register your GPU host so deployments have somewhere to land.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {runners.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-display font-semibold">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.region ?? "—"}</div>
                  </div>
                </div>
                <Badge className={STATUS_TONE[r.status] ?? STATUS_TONE.unknown}>
                  <Radio className="mr-1 h-3 w-3" />
                  {r.status}
                </Badge>
              </div>
              <div className="mb-3 truncate rounded-md bg-surface-2 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                {r.base_url}
              </div>
              <AgentTokenRow token={r.agent_token} />
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{r.gpu_type ?? "—"}</span>
                <span>Added {formatDate(r.created_at)}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => remove.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 p-5">
        <h2 className="font-display text-base font-semibold">Agent HTTP API</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your GPU agent authenticates with <code className="rounded bg-muted px-1">Authorization: Bearer &lt;agent_token&gt;</code> and polls the endpoints below.
        </p>
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
          <li>POST /api/public/v1/agent/heartbeat</li>
          <li>GET&nbsp;&nbsp;/api/public/v1/agent/jobs/next</li>
          <li>POST /api/public/v1/agent/deployments/&#123;id&#125;/status &nbsp;<span className="text-muted-foreground/70">{"{ status, container_id?, host?, error? }"}</span></li>
          <li>POST /api/public/v1/agent/deployments/&#123;id&#125;/logs &nbsp;<span className="text-muted-foreground/70">{"{ level, message } | { events: [...] }"}</span></li>
          <li>POST /api/public/v1/agent/deployments/&#123;id&#125;/metrics &nbsp;<span className="text-muted-foreground/70">{"{ gpu_util, memory_used_mb, vram_used_mb, tokens_per_sec }"}</span></li>
        </ul>
      </Card>
    </div>
  );
}

function AgentTokenRow({ token }: { token: string | null }) {
  const [show, setShow] = useState(false);
  if (!token) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
        {show ? token : "•".repeat(24)}
      </code>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShow((s) => !s)} aria-label="Toggle token">
        {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        onClick={() => { navigator.clipboard.writeText(token); toast.success("Token copied"); }}
        aria-label="Copy token"
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

