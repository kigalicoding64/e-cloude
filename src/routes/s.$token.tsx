import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Download, Lock, FileIcon } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/s/$token")({
  head: () => ({ meta: [{ title: "Shared file — E-Cloud" }] }),
  ssr: false,
  component: SharePage,
});

type ShareInfo = { name: string; size: number; mime_type: string; permission: string; download_url: string | null; preview_url: string | null };

async function fetchShare(token: string, password: string): Promise<ShareInfo> {
  const res = await fetch(`/api/public/v1/shares/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed" }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

function SharePage() {
  const { token } = Route.useParams();
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(true); // try first without password

  const { data, error, isLoading, refetch } = useQuery<ShareInfo>({
    queryKey: ["share", token, submitted ? password : ""],
    queryFn: () => fetchShare(token, password),
    retry: false,
    enabled: submitted,
  });

  const needsPassword = error?.message === "Password required" || error?.message === "Incorrect password";

  const download = useMutation({
    mutationFn: async () => {
      if (!data?.download_url) throw new Error("Download not available");
      const a = document.createElement("a"); a.href = data.download_url; a.download = data.name; a.click();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-hero-gradient">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/"><Logo /></Link>
          <Link to="/auth"><Button variant="outline" size="sm">Sign up for E-Cloud</Button></Link>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <Card className="w-full max-w-lg p-8 shadow-elegant">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : needsPassword ? (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); refetch(); }} className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Lock className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h1 className="font-display text-2xl font-bold">Password protected</h1>
                <p className="mt-1 text-sm text-muted-foreground">Enter the password to access this file.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </div>
              <Button type="submit" className="w-full">Unlock</Button>
            </form>
          ) : error ? (
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold text-destructive">{error.message}</h1>
              <p className="mt-2 text-sm text-muted-foreground">This link may have expired or been revoked.</p>
            </div>
          ) : data ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <FileIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">{data.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{formatBytes(data.size)} · {data.mime_type}</p>
              </div>
              {data.preview_url && data.mime_type.startsWith("image/") && (
                <img src={data.preview_url} alt={data.name} className="mx-auto max-h-64 rounded-lg" />
              )}
              {data.download_url ? (
                <Button size="lg" className="gap-2" onClick={() => download.mutate()}>
                  <Download className="h-4 w-4" /> Download
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">View-only share.</p>
              )}
            </div>
          ) : null}
        </Card>
      </div>
      <footer className="border-t border-border bg-background/50 py-4 text-center text-xs text-muted-foreground">
        Powered by <Link to="/" className="font-medium text-foreground hover:underline">E-Cloud</Link>
      </footer>
    </div>
  );
}
