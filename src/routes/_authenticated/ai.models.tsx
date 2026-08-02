import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Plus, Github, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ai/models")({
  head: () => ({ meta: [{ title: "AI Models — E-Cloud" }] }),
  component: ModelsPage,
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  building: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  running: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  stopped: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

function ModelsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    source_repo: "",
    source_ref: "main",
    framework: "pytorch",
    task: "text-generation",
    gpu_type: "T4",
    memory_mb: 8192,
    description: "",
  });

  const { data: models = [] } = useQuery({
    queryKey: ["ai-models", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_models")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      const slug = `${slugify(form.name)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: inserted, error } = await supabase.from("ai_models").insert({
        owner_id: user!.id,
        name: form.name.trim(),
        slug,
        description: form.description || null,
        source_repo: form.source_repo || null,
        source_ref: form.source_ref || "main",
        framework: form.framework,
        task: form.task,
        gpu_type: form.gpu_type,
        memory_mb: form.memory_mb,
        endpoint_path: `/api/public/v1/chat/${slug}`,
        status: "draft",
      }).select("id").single();
      if (error) throw error;
      // Seed initial version so we can pin & roll back later
      await supabase.from("ai_model_versions").insert({
        model_id: inserted.id,
        git_ref: form.source_ref || "main",
        source_repo: form.source_repo || null,
        deployment_config: {
          framework: form.framework,
          task: form.task,
          gpu_type: form.gpu_type,
          memory_mb: form.memory_mb,
        },
        notes: "Initial version",
        is_active: true,
        created_by: user!.id,
      });
    },
    onSuccess: () => {
      toast.success("Model registered");
      setOpen(false);
      setForm({ ...form, name: "", source_repo: "", description: "" });
      qc.invalidateQueries({ queryKey: ["ai-models"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">AI models</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register a model from a GitHub repo. Deployments run on your registered GPU runners.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New model</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Register a model</DialogTitle>
              <DialogDescription>Point at a public or private GitHub repo. Build & run happens on your GPU runner.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" placeholder="e.g. Llama-3-8B-Chat" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-repo">GitHub repo</Label>
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <Input id="m-repo" placeholder="owner/repo" value={form.source_repo} onChange={(e) => setForm({ ...form, source_repo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Branch / ref</Label>
                  <Input value={form.source_ref} onChange={(e) => setForm({ ...form, source_ref: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Framework</Label>
                  <Select value={form.framework} onValueChange={(v) => setForm({ ...form, framework: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pytorch">PyTorch</SelectItem>
                      <SelectItem value="tensorflow">TensorFlow</SelectItem>
                      <SelectItem value="transformers">Transformers</SelectItem>
                      <SelectItem value="vllm">vLLM</SelectItem>
                      <SelectItem value="onnx">ONNX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Task</Label>
                  <Select value={form.task} onValueChange={(v) => setForm({ ...form, task: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text-generation">Text generation</SelectItem>
                      <SelectItem value="chat">Chat</SelectItem>
                      <SelectItem value="embeddings">Embeddings</SelectItem>
                      <SelectItem value="image-generation">Image generation</SelectItem>
                      <SelectItem value="speech-to-text">Speech-to-text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>GPU</Label>
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
                <Label htmlFor="m-desc">Description</Label>
                <Textarea id="m-desc" rows={2} placeholder="What does this model do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>Register</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {models.length === 0 ? (
        <Card className="p-16 text-center">
          <Brain className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No models yet. Register one to get started.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {models.map((m) => (
            <Link
              key={m.id}
              to="/ai/models/$slug"
              params={{ slug: m.slug }}
              className="group block"
            >
              <Card className="p-5 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display text-lg font-semibold">{m.name}</h3>
                      <Badge className={STATUS_TONE[m.status] ?? STATUS_TONE.draft}>{m.status}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {m.description || m.source_repo || "No description"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      {m.framework && <span className="rounded bg-muted px-1.5 py-0.5">{m.framework}</span>}
                      {m.task && <span className="rounded bg-muted px-1.5 py-0.5">{m.task}</span>}
                      {m.gpu_type && <span className="rounded bg-muted px-1.5 py-0.5">{m.gpu_type}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate font-mono">{m.endpoint_path}</span>
                  <span>{formatDate(m.created_at)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
