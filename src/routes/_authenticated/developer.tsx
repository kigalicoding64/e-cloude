import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Code2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/developer")({
  head: () => ({ meta: [{ title: "Developer — E-Cloud" }] }),
  component: DeveloperPage,
});

type Endpoint = { method: string; path: string; desc: string; sample: string };

const endpoints: Endpoint[] = [
  {
    method: "GET", path: "/api/public/v1/files",
    desc: "List all files owned by the API key's user. Supports ?folder=<uuid> and ?limit=&offset= params.",
    sample: `curl https://YOUR_APP/api/public/v1/files \\
  -H "X-API-Key: eck_live_..."`,
  },
  {
    method: "POST", path: "/api/public/v1/files/upload",
    desc: "Upload a file. Send as multipart/form-data with field 'file'. Optional 'folder' (folder UUID).",
    sample: `curl -X POST https://YOUR_APP/api/public/v1/files/upload \\
  -H "X-API-Key: eck_live_..." \\
  -F "file=@invoice.pdf"`,
  },
  {
    method: "GET", path: "/api/public/v1/files/:id",
    desc: "Get file metadata and a short-lived signed download URL (60s).",
    sample: `curl https://YOUR_APP/api/public/v1/files/{id} \\
  -H "X-API-Key: eck_live_..."`,
  },
  {
    method: "DELETE", path: "/api/public/v1/files/:id",
    desc: "Delete a file permanently (removes from storage and frees quota).",
    sample: `curl -X DELETE https://YOUR_APP/api/public/v1/files/{id} \\
  -H "X-API-Key: eck_live_..."`,
  },
];

function methodBadge(m: string) {
  const map: Record<string, string> = {
    GET: "bg-primary-soft text-primary",
    POST: "bg-success/15 text-success",
    DELETE: "bg-destructive/10 text-destructive",
    PATCH: "bg-warning/15 text-warning",
  };
  return `rounded px-2 py-0.5 font-mono text-xs font-semibold ${map[m] ?? "bg-muted text-muted-foreground"}`;
}

function DeveloperPage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          <Code2 className="h-3 w-3" /> REST API v1
        </div>
        <h1 className="font-display text-3xl font-bold">E-Cloud API</h1>
        <p className="mt-2 text-muted-foreground">
          Authenticate every request with the <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">X-API-Key</code> header.
          Generate keys from the <a className="text-primary hover:underline" href="/api-keys">API Keys</a> page.
        </p>
      </div>

      <Card className="mb-8 p-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Authentication</h2>
        <p className="mb-3 text-sm text-muted-foreground">All API calls require your API key in the request header.</p>
        <pre className="overflow-x-auto rounded-md bg-surface-2 p-4 text-xs"><code className="font-mono">X-API-Key: eck_live_XXXXXXXXXXXXXXXXXXXXXXXX</code></pre>
      </Card>

      <div className="space-y-4">
        {endpoints.map((e) => (
          <Card key={e.method + e.path} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-3">
              <span className={methodBadge(e.method)}>{e.method}</span>
              <code className="font-mono text-sm">{e.path}</code>
            </div>
            <div className="p-4">
              <p className="mb-3 text-sm text-muted-foreground">{e.desc}</p>
              <pre className="overflow-x-auto rounded-md bg-surface-2 p-4 text-xs"><code className="font-mono">{e.sample}</code></pre>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-6">
        <h2 className="mb-2 font-display text-lg font-semibold">Response format</h2>
        <p className="mb-3 text-sm text-muted-foreground">All responses are JSON. Errors return a non-2xx status code with <code className="font-mono text-xs">{`{ "error": "message" }`}</code>.</p>
      </Card>
    </div>
  );
}
