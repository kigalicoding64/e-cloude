import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatBytes } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — E-Cloud" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const [name, setName] = useState("");
  useEffect(() => { if (profile?.display_name) setName(profile.display_name); }, [profile?.display_name]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name required");
      const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold">Settings</h1>

      <Card className="p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Profile</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dname">Display name</Label>
            <Input id="dname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save changes</Button>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Storage</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Used</div>
            <div className="font-display text-xl font-semibold">{formatBytes(Number(profile?.storage_used ?? 0))}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Quota</div>
            <div className="font-display text-xl font-semibold">{formatBytes(Number(profile?.storage_quota ?? 0))}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
