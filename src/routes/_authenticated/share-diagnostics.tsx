import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Clock, Lock, Unlock, Link2, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { diagnoseShareLink, PUBLIC_BASE_URL, type ShareDiagnostic } from "@/lib/share-diagnostics.functions";

export const Route = createFileRoute("/_authenticated/share-diagnostics")({
  head: () => ({
    meta: [
      { title: "Share Link Diagnostics — E-Cloud" },
      {
        name: "description",
        content:
          "Check whether an E-Cloud share link is valid, expired, revoked, or password protected on cloud.egreedtech.org.",
      },
      { property: "og:title", content: "Share Link Diagnostics — E-Cloud" },
      {
        property: "og:description",
        content: "Verify share link validity, expiry and password requirements for cloud.egreedtech.org.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiagnosticsPage,
});

function Row({ ok, label, value, icon }: { ok: boolean | null; label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={`flex items-center gap-2 text-sm font-medium ${ok === false ? "text-destructive" : ok ? "text-primary" : ""}`}>
        {ok === true && <CheckCircle2 className="h-4 w-4" />}
        {ok === false && <XCircle className="h-4 w-4" />}
        {value}
      </span>
    </div>
  );
}

function DiagnosticsPage() {
  const run = useServerFn(diagnoseShareLink);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ShareDiagnostic | null>(null);

  const check = useMutation({
    mutationFn: async () => (await run({ data: { input } })) as ShareDiagnostic,
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const verdictText: Record<ShareDiagnostic["verdict"], string> = {
    valid: "Link is live and resolvable",
    expired: "Link has expired",
    missing: "No such link (revoked, deleted, or not yours)",
    "file-missing": "Link exists but the file is gone",
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="font-display text-3xl font-bold">Share link diagnostics</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste a share link or token to see whether it is valid, expired, revoked, and whether a password is
        required. Public links resolve at <span className="font-mono">{PUBLIC_BASE_URL}/s/&lt;token&gt;</span>.
      </p>

      <Card className="mt-6 p-6">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) check.mutate();
          }}
        >
          <Label htmlFor="share-input">Share link or token</Label>
          <div className="flex gap-2">
            <Input
              id="share-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`${PUBLIC_BASE_URL}/s/abc123...`}
              autoFocus
            />
            <Button type="submit" disabled={check.isPending || !input.trim()}>
              {check.isPending ? "Checking…" : "Check link"}
            </Button>
          </div>
        </form>
      </Card>

      {result && (
        <Card className="mt-6 p-6">
          <div className="mb-4 flex items-center gap-3">
            {result.verdict === "valid" ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <h2 className="font-display text-lg font-semibold">{verdictText[result.verdict]}</h2>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono text-xs">{result.url}</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              onClick={() => {
                navigator.clipboard.writeText(result.url).catch(() => {});
                toast.success("Copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <Row ok={result.found} label="Link record exists" value={result.found ? "Yes" : "No"} />
          <Row
            ok={result.found ? !result.expired : null}
            label="Expiry"
            icon={<Clock className="h-4 w-4" />}
            value={
              !result.found
                ? "—"
                : result.expires_at
                  ? `${result.expired ? "Expired" : "Expires"} ${formatDate(result.expires_at)}`
                  : "Never expires"
            }
          />
          <Row
            ok={null}
            label="Password required"
            icon={result.requires_password ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            value={!result.found ? "—" : result.requires_password ? "Yes — visitors must enter it" : "No"}
          />
          <Row ok={result.found ? result.file_present : null} label="File still available" value={!result.found ? "—" : result.file_present ? (result.file_name ?? "Yes") : "Deleted"} />
          <Row ok={null} label="File-level lock" value={!result.found ? "—" : result.file_locked ? "Password/PIN set on file" : "None"} />
          <Row ok={null} label="Permission" value={result.permission ?? "—"} />
          <Row ok={null} label="Views" value={result.view_count != null ? String(result.view_count) : "—"} />
          <Row ok={null} label="Created" value={result.created_at ? formatDate(result.created_at) : "—"} />

          {!result.found && (
            <p className="mt-4 text-sm text-muted-foreground">
              If you know this link should work, it may have been created by another account, revoked, or the
              custom domain may still be serving an older deployment — republish to refresh it.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
