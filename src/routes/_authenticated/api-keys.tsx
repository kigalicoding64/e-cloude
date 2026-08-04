import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { KeyRound, Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { generateApiKey, sha256Hex } from "@/lib/hash";
import { z } from "zod";
import { API_SCOPES, SCOPE_DESCRIPTIONS, type ApiScope } from "@/lib/api-errors";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — E-Cloud" }] }),
  component: ApiKeysPage,
});

const nameSchema = z.string().trim().min(1).max(60);

function ApiKeysPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [scopes, setScopes] = useState<ApiScope[]>(["read", "download", "upload", "manage"]);

  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("api_keys").select("id,name,key_prefix,scopes,last_used_at,is_active,created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = nameSchema.safeParse(newName);
      if (!parsed.success) throw new Error("Name must be 1–60 chars");
      if (scopes.length === 0) throw new Error("Select at least one permission");
      const key = generateApiKey();
      const key_hash = await sha256Hex(key);
      const key_prefix = key.slice(0, 16);
      const { error } = await supabase.from("api_keys").insert({
        user_id: user!.id, name: parsed.data, key_hash, key_prefix, scopes,
      });
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      setCreatedKey(key);
      setNewName("");
      setNewOpen(false);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Key revoked"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
  });

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">API keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use these to authenticate external apps against the E-Cloud REST API.</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New API key</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create API key</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="key-name">Key name</Label>
              <Input id="key-name" placeholder="e.g. IBONA production" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <div className="mt-4 space-y-2">
              <Label>Permissions (scopes)</Label>
              {API_SCOPES.map((s) => (
                <label key={s} className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                  <Checkbox
                    checked={scopes.includes(s)}
                    onCheckedChange={(c) =>
                      setScopes((prev) => (c ? [...new Set([...prev, s])] : prev.filter((x) => x !== s)))
                    }
                  />
                  <span>
                    <span className="font-mono text-xs font-semibold">{s}</span>
                    <span className="block text-xs text-muted-foreground">{SCOPE_DESCRIPTIONS[s]}</span>
                  </span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>Generate key</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <Card className="p-16 text-center">
          <KeyRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">You haven't created any API keys yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Key</th><th className="px-4 py-3">Scopes</th><th className="px-4 py-3">Last used</th><th className="px-4 py-3">Created</th><th></th></tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-border">
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.key_prefix}…</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {((k.scopes ?? []) as string[]).map((s) => (
                        <span key={s} className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] text-primary">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{k.last_used_at ? formatDate(k.last_used_at) : "Never"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(k.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => revoke.mutate(k.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={!!createdKey} onOpenChange={(o) => !o && setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>Copy it now — we don't store it in plain text and it can't be shown again.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <code className="break-all font-mono text-sm">{createdKey}</code>
          </div>
          <DialogFooter>
            <Button className="gap-2" onClick={() => {
              if (createdKey) { navigator.clipboard.writeText(createdKey); toast.success("Copied to clipboard"); }
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
