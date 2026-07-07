import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, ArrowRight, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations")({
  head: () => ({ meta: [{ title: "Organizations — E-Cloud" }] }),
  component: OrgsPage,
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function OrgsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data } = useQuery({
    queryKey: ["orgs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function create() {
    if (!name.trim()) return toast.error("Enter a name");
    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
    const { data: org, error } = await supabase.from("organizations").insert({
      name: name.trim(), slug, owner_id: user!.id,
    }).select().single();
    if (error) return toast.error(error.message);
    // Add owner as member (owner role)
    await supabase.from("organization_members").insert({ org_id: org.id, user_id: user!.id, role: "owner" });
    toast.success("Organization created");
    setOpen(false); setName("");
    qc.invalidateQueries({ queryKey: ["orgs"] });
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Organizations</h1>
            <p className="text-sm text-muted-foreground">Workspaces for teams, schools, and companies.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New organization</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create organization</DialogTitle></DialogHeader>
            <div>
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Muhazi Dental Clinic" autoFocus />
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {(data ?? []).length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          You're not part of any organization yet. Create one to collaborate with your team.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-semibold">{o.name}</h3>
                  <div className="font-mono text-xs text-muted-foreground">{o.slug}</div>
                  {o.owner_id === user?.id && <span className="mt-2 inline-block rounded bg-primary-soft px-2 py-0.5 text-xs text-primary">Owner</span>}
                </div>
                <Building2 className="h-5 w-5 text-primary/40" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{o.storage_quota_gb} GB storage</span>
                <Link to="/organizations/$id" params={{ id: o.id }}>
                  <Button size="sm" variant="ghost" className="gap-1">
                    <Users className="h-4 w-4" /> Manage <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
