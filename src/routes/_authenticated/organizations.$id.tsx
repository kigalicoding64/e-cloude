import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/organizations/$id")({
  head: () => ({ meta: [{ title: "Organization — E-Cloud" }] }),
  component: OrgDetail,
});

function OrgDetail() {
  const { id } = useParams({ from: "/_authenticated/organizations/$id" });
  const { user } = useSession();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");

  const { data: org } = useQuery({
    queryKey: ["org", id],
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["org-members", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("id, user_id, role, created_at")
        .eq("org_id", id)
        .order("created_at", { ascending: true });
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids)
        : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }> };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        profiles: map.get(r.user_id) ?? null,
      }));
    },
  });

  const isOwner = org?.owner_id === user?.id;

  async function invite() {
    if (!email.trim()) return toast.error("Enter an email");
    // Look up user by email in profiles (fallback: nothing if user doesn't exist)
    const { data: match } = await supabase.from("profiles").select("id").ilike("display_name", email.trim()).maybeSingle();
    if (!match) {
      toast.error("User not found. They must sign up to E-Cloud first, then try again with their display name.");
      return;
    }
    const { error } = await supabase.from("organization_members").insert({
      org_id: id, user_id: match.id, role,
    });
    if (error) return toast.error(error.message);
    toast.success("Member added");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["org-members", id] });
  }

  async function updateRole(memberId: string, newRole: string) {
    await supabase.from("organization_members").update({ role: newRole }).eq("id", memberId);
    qc.invalidateQueries({ queryKey: ["org-members", id] });
  }

  async function remove(memberId: string) {
    await supabase.from("organization_members").delete().eq("id", memberId);
    toast.success("Member removed");
    qc.invalidateQueries({ queryKey: ["org-members", id] });
  }

  if (!org) return <div className="p-10">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <Link to="/organizations" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to organizations
      </Link>

      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold">{org.name}</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{org.slug}</p>
      </header>

      {isOwner && (
        <Card className="mb-6 p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4" /> Invite member</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="mem-email">Member display name</Label>
              <Input id="mem-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Existing E-Cloud user's display name" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={invite}>Add</Button>
          </div>
        </Card>
      )}

      <Card className="divide-y divide-border">
        {(members ?? []).map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {(m.profiles?.display_name || "?")[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{m.profiles?.display_name || m.user_id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">Joined {formatDate(m.created_at)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && m.user_id !== org.owner_id ? (
                <Select value={m.role} onValueChange={(v) => updateRole(m.id, v)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="rounded bg-muted px-2 py-1 text-xs capitalize">{m.role}</span>
              )}
              {isOwner && m.user_id !== org.owner_id && (
                <Button size="icon" variant="ghost" onClick={() => remove(m.id)} aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
