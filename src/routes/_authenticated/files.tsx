import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Clock, Folder, FolderPlus, Upload, Star, Trash2, Share2, Download, MoreVertical, ChevronRight, Home, LayoutGrid, List as ListIcon, Search, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatDate, iconForMime } from "@/lib/format";
import { randomToken } from "@/lib/hash";
import { useServerFn } from "@tanstack/react-start";
import { setFileLock, verifyFileLock } from "@/lib/file-lock.functions";
import { fileLockState, lockSummary } from "@/lib/file-lock";

import { z } from "zod";

export const Route = createFileRoute("/_authenticated/files")({
  head: () => ({ meta: [{ title: "My Files — E-Cloud" }] }),
  validateSearch: (s: Record<string, unknown>): { folder?: string } =>
    typeof s.folder === "string" && s.folder ? { folder: s.folder } : {},
  component: FilesPage,
});

const folderNameSchema = z.string().trim().min(1).max(80);
const fileNameSchema = z.string().trim().min(1).max(200);

function FilesPage() {
  const { folder } = Route.useSearch();
  const folderId = folder ?? null;
  const { user } = useSession();
  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [detailsFile, setDetailsFile] = useState<FileRow | null>(null);
  const [lockTarget, setLockTarget] = useState<{ id: string; name: string; hasPassword: boolean; hasPin: boolean } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; kind: "file" | "folder" } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const doVerify = useServerFn(verifyFileLock);

  const requireUnlock = async (f: { id: string; name: string; password_hash: string | null; pin_hash: string | null }) => {
    const state = fileLockState(f);
    if (!state.locked) return true;
    if (verifiedIds.has(f.id)) return true;
    const kind = state.promptKind!;
    const secret = window.prompt(`Enter ${kind} for "${f.name}"`);
    if (!secret) return false;
    try {

      await doVerify({ data: { file_id: f.id, secret, kind } });
      setVerifiedIds((s) => new Set(s).add(f.id));
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wrong secret");
      return false;
    }
  };

  const { data: currentFolder } = useQuery({
    queryKey: ["folder", folderId],
    enabled: !!folderId,
    queryFn: async () => {
      const { data } = await supabase.from("folders").select("*").eq("id", folderId!).maybeSingle();
      return data;
    },
  });

  const { data: crumbs = [] } = useQuery({
    queryKey: ["breadcrumbs", folderId],
    enabled: !!folderId,
    queryFn: async () => {
      const path: { id: string; name: string }[] = [];
      let cur = folderId;
      while (cur) {
        const { data } = await supabase.from("folders").select("id,name,parent_id").eq("id", cur).maybeSingle();
        if (!data) break;
        path.unshift({ id: data.id, name: data.name });
        cur = data.parent_id as string | null;
      }
      return path;
    },
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id, folderId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("folders").select("*").eq("user_id", user!.id).order("name");
      q = folderId ? q.eq("parent_id", folderId) : q.is("parent_id", null);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", user?.id, folderId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("files").select("*").eq("user_id", user!.id).eq("is_trashed", false).order("created_at", { ascending: false });
      q = folderId ? q.eq("folder_id", folderId) : q.is("folder_id", null);
      const { data } = await q;
      return data ?? [];
    },
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const parsed = folderNameSchema.safeParse(name);
      if (!parsed.success) throw new Error("Folder name must be 1–80 characters");
      const { error } = await supabase.from("folders").insert({
        user_id: user!.id,
        parent_id: folderId,
        name: parsed.data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folder created");
      setNewFolderOpen(false);
      setNewFolderName("");
      qc.invalidateQueries({ queryKey: ["folders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const parsed = fileNameSchema.safeParse(file.name);
      if (!parsed.success) throw new Error("Invalid file name");
      const storagePath = `${user!.id}/${randomToken(16)}-${parsed.data}`;
      const { error: upErr } = await supabase.storage.from("user-files").upload(storagePath, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("files").insert({
        user_id: user!.id,
        folder_id: folderId,
        name: parsed.data,
        size: file.size,
        mime_type: file.type || "application/octet-stream",
        storage_path: storagePath,
      });
      if (dbErr) throw dbErr;
      const { data: prof } = await supabase.from("profiles").select("storage_used").eq("id", user!.id).maybeSingle();
      const newUsed = Number(prof?.storage_used ?? 0) + file.size;
      await supabase.from("profiles").update({ storage_used: newUsed }).eq("id", user!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    for (const file of Array.from(list)) {
      try {
        await uploadFile.mutateAsync(file);
        toast.success(`Uploaded ${file.name}`);
      } catch { /* toast handled */ }
    }
    e.target.value = "";
  };

  const trashFile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("files").update({ is_trashed: true, trashed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Moved to trash");
      qc.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFav = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("files").update({ is_favorite: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });

  const renameItem = useMutation({
    mutationFn: async () => {
      if (!renameTarget) return;
      const parsed = (renameTarget.kind === "folder" ? folderNameSchema : fileNameSchema).safeParse(renameValue);
      if (!parsed.success) throw new Error("Invalid name");
      const table = renameTarget.kind === "folder" ? "folders" : "files";
      const { error } = await supabase.from(table).update({ name: parsed.data }).eq("id", renameTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Renamed");
      setRenameTarget(null);
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["folders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trashFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Folder deleted"); qc.invalidateQueries({ queryKey: ["folders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadFile = async (f: { id: string; storage_path: string; name: string; password_hash: string | null; pin_hash: string | null }) => {
    if (!(await requireUnlock(f))) return;
    const { data, error } = await supabase.storage.from("user-files").createSignedUrl(f.storage_path, 60);
    if (error || !data) return toast.error("Download failed");
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = f.name; a.click();
  };

  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
  const filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link to="/files" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <Home className="h-4 w-4" /> My Files
        </Link>
        {crumbs.map((c) => (
          <span key={c.id} className="flex items-center gap-2 text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
            <Link to="/files" search={{ folder: c.id }} className="hover:text-foreground">{c.name}</Link>
          </span>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{currentFolder?.name || "My Files"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." className="w-56 pl-9" />
          </div>
          <div className="flex overflow-hidden rounded-md border border-border">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setView("list")}><ListIcon className="h-4 w-4" /></Button>
          </div>
          <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><FolderPlus className="h-4 w-4" /> New folder</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create folder</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="fname">Name</Label>
                <Input id="fname" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
                <Button onClick={() => createFolder.mutate(newFolderName)} disabled={createFolder.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
          <Button className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
      </div>

      {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <h3 className="mb-1 font-display text-xl font-semibold">This folder is empty</h3>
          <p className="mb-4 text-sm text-muted-foreground">Upload files or create a folder to get started.</p>
          <Button className="gap-2" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Upload files</Button>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredFolders.map((f) => (
            <Card key={f.id} className="group relative overflow-hidden p-4 transition-all hover:shadow-elegant">
              <Link to="/files" search={{ folder: f.id }} className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Folder className="h-7 w-7" />
                </div>
                <div className="w-full truncate text-center text-sm font-medium">{f.name}</div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { setRenameTarget({ id: f.id, name: f.name, kind: "folder" }); setRenameValue(f.name); }}>Rename</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => trashFolder.mutate(f.id)}>Delete folder</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
          {filteredFiles.map((f) => {
            const lock = fileLockState(f);
            return (
            <Card key={f.id} className="group relative overflow-hidden p-4 transition-all hover:shadow-elegant">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-soft font-mono text-xs uppercase text-primary">
                  {iconForMime(f.mime_type).slice(0, 3)}
                </div>
                <div className="w-full truncate text-center text-sm font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">{formatBytes(Number(f.size))}</div>
                <span
                  title={lockSummary(f)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                    lock.locked
                      ? "border-primary/30 bg-primary-soft text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {lock.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {lock.label}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => downloadFile(f)}><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDetailsFile(f)}><Clock className="mr-2 h-4 w-4" /> Details &amp; secure link</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShareFileId(f.id)}><Share2 className="mr-2 h-4 w-4" /> Share</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleFav.mutate({ id: f.id, val: !f.is_favorite })}>
                    <Star className={`mr-2 h-4 w-4 ${f.is_favorite ? "fill-primary text-primary" : ""}`} />
                    {f.is_favorite ? "Unfavorite" : "Favorite"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLockTarget({ id: f.id, name: f.name, hasPassword: lock.hasPassword, hasPin: lock.hasPin })}>
                    <Lock className="mr-2 h-4 w-4" /> Manage security
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setRenameTarget({ id: f.id, name: f.name, kind: "file" }); setRenameValue(f.name); }}>Rename</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => trashFile.mutate(f.id)}><Trash2 className="mr-2 h-4 w-4" /> Move to trash</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {f.is_favorite && <Star className="absolute left-2 top-2 h-3.5 w-3.5 fill-primary text-primary" />}
            </Card>
            );
          })}

        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Security</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Modified</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredFolders.map((f) => (
                <tr key={f.id} className="border-b border-border hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link to="/files" search={{ folder: f.id }} className="flex items-center gap-3 font-medium">
                      <Folder className="h-4 w-4 text-primary" /> {f.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(f.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => trashFolder.mutate(f.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {filteredFiles.map((f) => {
                const lock = fileLockState(f);
                return (
                <tr key={f.id} className="border-b border-border hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 font-medium">
                      <span className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] uppercase text-primary">{iconForMime(f.mime_type).slice(0, 3)}</span>
                      {f.name}
                      {f.is_favorite && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      title={lockSummary(f)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
                        lock.locked
                          ? "border-primary/30 bg-primary-soft text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {lock.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      {lock.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatBytes(Number(f.size))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(f.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadFile(f)}><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDetailsFile(f)}><Clock className="mr-2 h-4 w-4" /> Details &amp; secure link</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShareFileId(f.id)}><Share2 className="mr-2 h-4 w-4" /> Share</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleFav.mutate({ id: f.id, val: !f.is_favorite })}>
                          <Star className={`mr-2 h-4 w-4 ${f.is_favorite ? "fill-primary text-primary" : ""}`} />
                          {f.is_favorite ? "Unfavorite" : "Favorite"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLockTarget({ id: f.id, name: f.name, hasPassword: lock.hasPassword, hasPin: lock.hasPin })}>
                          <Lock className="mr-2 h-4 w-4" /> Manage security
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRenameTarget({ id: f.id, name: f.name, kind: "file" }); setRenameValue(f.name); }}>Rename</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => trashFile.mutate(f.id)}><Trash2 className="mr-2 h-4 w-4" /> Move to trash</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
                );
              })}
            </tbody>

          </table>
        </Card>
      )}

      <FileDetailsDialog file={detailsFile} onClose={() => setDetailsFile(null)} />
      <ShareDialog fileId={shareFileId} onClose={() => setShareFileId(null)} />
      <LockDialog target={lockTarget} onClose={() => setLockTarget(null)} onChanged={() => { setVerifiedIds(new Set()); qc.invalidateQueries({ queryKey: ["files"] }); }} />

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename {renameTarget?.kind}</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={() => renameItem.mutate()} disabled={renameItem.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FileRow = {
  id: string; name: string; size: number; mime_type: string | null; storage_path: string;
  created_at: string; updated_at: string; password_hash: string | null; pin_hash: string | null;
};

const EXPIRY_OPTIONS = [
  { label: "5 minutes", seconds: 300 },
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
];

function FileDetailsDialog({ file, onClose }: { file: FileRow | null; onClose: () => void }) {
  const [seconds, setSeconds] = useState(3600);
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLink(null);
    setSeconds(3600);
  }, [file?.id]);

  useEffect(() => {
    if (!link) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [link]);

  const remaining = link ? Math.max(0, Math.floor((link.expiresAt - now) / 1000)) : 0;
  const lock = file ? fileLockState(file) : null;

  const generate = async () => {
    if (!file) return;
    setBusy(true);
    const { data, error } = await supabase.storage
      .from("user-files")
      .createSignedUrl(file.storage_path, seconds, { download: file.name });
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Could not create link");
    setLink({ url: data.signedUrl, expiresAt: Date.now() + seconds * 1000 });
  };

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="truncate">{file?.name}</DialogTitle></DialogHeader>
        {file && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-muted-foreground">Size</dt><dd>{formatBytes(file.size)}</dd>
              <dt className="text-muted-foreground">Type</dt><dd className="truncate">{file.mime_type ?? "unknown"}</dd>
              <dt className="text-muted-foreground">Created</dt><dd>{formatDate(file.created_at)}</dd>
              <dt className="text-muted-foreground">Modified</dt><dd>{formatDate(file.updated_at)}</dd>
              <dt className="text-muted-foreground">Security</dt><dd>{lockSummary(file)}</dd>
            </dl>

            <div className="space-y-2 rounded-lg border p-3">
              <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Time-limited download link</Label>
              <div className="flex flex-wrap gap-2">
                {EXPIRY_OPTIONS.map((o) => (
                  <Button
                    key={o.seconds}
                    size="sm"
                    variant={seconds === o.seconds ? "default" : "outline"}
                    onClick={() => setSeconds(o.seconds)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              <Button size="sm" onClick={generate} disabled={busy || !!lock?.locked}>
                {busy ? "Signing…" : "Generate signed link"}
              </Button>
              {lock?.locked && (
                <p className="text-xs text-muted-foreground">
                  Unlock this file (Manage security) before issuing signed links.
                </p>
              )}
              {link && (
                <div className="space-y-2">
                  <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(link.expiresAt).toLocaleString()} ·{" "}
                    {remaining > 0 ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m ${remaining % 60}s left` : "expired"}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link.url); toast.success("Link copied"); }}>
                    Copy link
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ fileId, onClose }: { fileId: string | null; onClose: () => void }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [expiresIn, setExpiresIn] = useState<string>("7");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState<"view" | "download">("download");

  const create = useMutation({
    mutationFn: async () => {
      if (!fileId) return null;
      const token = randomToken(16);
      const expires_at = expiresIn === "0" ? null : new Date(Date.now() + Number(expiresIn) * 86400_000).toISOString();
      const password_hash = password ? await (await import("@/lib/hash")).sha256Hex(password) : null;
      const { data, error } = await supabase.from("shares").insert({
        file_id: fileId, created_by: user!.id, token, expires_at, password_hash, permission,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (!data) return;
      const url = `${PUBLIC_BASE_URL}/s/${data.token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Share link copied to clipboard");
      qc.invalidateQueries({ queryKey: ["shares"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!fileId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Share file</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Expires in</Label>
            <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="0">Never</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Permission</Label>
            <select value={permission} onChange={(e) => setPermission(e.target.value as "view" | "download")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="view">View only</option>
              <option value="download">Download</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Password (optional)</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for no password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Create & copy link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LockDialog({
  target, onClose, onChanged,
}: {
  target: { id: string; name: string; hasPassword: boolean; hasPin: boolean } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const set = useServerFn(setFileLock);
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async (patch: { password?: string; pin?: string }) => {
    if (!target) return;
    setBusy(true);
    try {
      await set({ data: { file_id: target.id, ...patch } });
      toast.success("Updated");
      setPassword(""); setPin("");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lock file</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground truncate">{target.name}</p>
            <div className="space-y-2">
              <Label>Password {target.hasPassword && <span className="text-xs text-primary">(currently set)</span>}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !password} onClick={() => apply({ password })}>Set password</Button>
                {target.hasPassword && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => apply({ password: "" })}>Remove</Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>PIN (4–8 digits) {target.hasPin && <span className="text-xs text-primary">(currently set)</span>}</Label>
              <Input inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="New PIN" />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || pin.length < 4} onClick={() => apply({ pin })}>Set PIN</Button>
                {target.hasPin && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => apply({ pin: "" })}>Remove</Button>
                )}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
