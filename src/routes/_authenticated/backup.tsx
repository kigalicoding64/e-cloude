import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CloudUpload, Plus, Trash2, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [{ title: "Backup Center — E-Cloud" }] }),
  component: BackupPage,
});

const SOURCE_OPTIONS = ["Computer", "Phone", "Database", "Website", "External drive"];

function BackupPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"hourly" | "daily" | "weekly" | "monthly">("daily");
  const [sources, setSources] = useState<string[]>(["Computer"]);

  const { data: schedules } = useQuery({
    queryKey: ["backup-schedules", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("backup_schedules").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function create() {
    if (!name.trim()) return toast.error("Give the backup a name");
    const nextRun = new Date();
    if (frequency === "hourly") nextRun.setHours(nextRun.getHours() + 1);
    if (frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
    if (frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
    if (frequency === "monthly") nextRun.setMonth(nextRun.getMonth() + 1);
    const { error } = await supabase.from("backup_schedules").insert({
      user_id: user!.id, name, frequency, sources, next_run_at: nextRun.toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Backup schedule created");
    setOpen(false); setName(""); setSources(["Computer"]); setFrequency("daily");
    qc.invalidateQueries({ queryKey: ["backup-schedules"] });
  }

  async function toggle(id: string, enabled: boolean) {
    await supabase.from("backup_schedules").update({ enabled }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["backup-schedules"] });
  }

  async function remove(id: string) {
    await supabase.from("backup_schedules").delete().eq("id", id);
    toast.success("Schedule removed");
    qc.invalidateQueries({ queryKey: ["backup-schedules"] });
  }

  function toggleSource(s: string, on: boolean) {
    setSources((prev) => on ? [...new Set([...prev, s])] : prev.filter((x) => x !== s));
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <CloudUpload className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Backup Center</h1>
            <p className="text-sm text-muted-foreground">Automated backups for devices, databases, and websites.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New backup</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create backup schedule</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="bk-name">Name</Label>
                <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightly laptop backup" />
              </div>
              <div>
                <Label>Sources</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SOURCE_OPTIONS.map((s) => (
                    <label key={s} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <Checkbox checked={sources.includes(s)} onCheckedChange={(v) => toggleSource(s, !!v)} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {(schedules ?? []).length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No backup schedules yet. Click "New backup" to create one.
        </Card>
      ) : (
        <div className="grid gap-3">
          {(schedules ?? []).map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{s.name}</h3>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{s.frequency}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  Sources: {(s.sources ?? []).map((x: string) => (
                    <span key={x} className="rounded bg-primary-soft px-1.5 py-0.5 text-primary">{x}</span>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {s.last_run_at ? `Last run ${formatDate(s.last_run_at)}` : "Never run"}
                  {s.next_run_at && <> · Next {formatDate(s.next_run_at)}</>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={s.enabled} onCheckedChange={(v) => toggle(s.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => remove(s.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Backups run in the background on their schedule. Set up backup agents on your devices from Settings → Devices to start syncing.
      </p>
    </div>
  );
}
