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
    method: "GET", path: "/api/public/v1",
    desc: "Discovery document — lists every endpoint, the auth scheme and the error format. No API key required, so SDKs can self-configure.",
    sample: `curl https://cloud.egreedtech.org/api/public/v1`,
  },
  {
    method: "GET", path: "/api/public/v1/health",
    desc: "Liveness probe (no key required). Returns 200 when API + database are reachable, 503 when degraded.",
    sample: `curl https://cloud.egreedtech.org/api/public/v1/health
# => { "status": "ok", "api": "ok", "database": "ok" }`,
  },
  {
    method: "GET", path: "/api/public/v1/me",
    desc: "Account the API key belongs to, with file count and storage usage/quota — use it to verify a key and check remaining space before uploading.",
    sample: `curl https://cloud.egreedtech.org/api/public/v1/me \\
  -H "X-API-Key: eck_live_..."`,
  },
  {
    method: "PATCH", path: "/api/public/v1/files/:id",
    desc: "Rename, move between folders, favorite, or trash/restore a file.",
    sample: `curl -X PATCH https://cloud.egreedtech.org/api/public/v1/files/{id} \\
  -H "X-API-Key: eck_live_..." -H "Content-Type: application/json" \\
  -d '{"name":"report-final.pdf","folder_id":null,"is_favorite":true}'`,
  },
  {
    method: "GET", path: "/api/public/v1/folders",
    desc: "List folders (optional ?parent=<id>). POST to create one, PATCH /folders/:id to rename or move, DELETE /folders/:id when empty.",
    sample: `curl https://cloud.egreedtech.org/api/public/v1/folders \\
  -H "X-API-Key: eck_live_..."

curl -X POST https://cloud.egreedtech.org/api/public/v1/folders \\
  -H "X-API-Key: eck_live_..." -H "Content-Type: application/json" \\
  -d '{"name":"Clinic scans"}'`,
  },
  {
    method: "GET", path: "/api/public/v1/files",
    desc: "List all files owned by the API key's user. Supports ?folder=<uuid> and ?limit=&offset= params.",
    sample: `curl https://cloud.egreedtech.org/api/public/v1/files \\
  -H "X-API-Key: eck_live_..."`,
  },
  {
    method: "POST", path: "/api/public/v1/files/upload",
    desc: "Upload a file. Send as multipart/form-data with field 'file'. Optional 'folder' (folder UUID).",
    sample: `curl -X POST https://cloud.egreedtech.org/api/public/v1/files/upload \\
  -H "X-API-Key: eck_live_..." \\
  -F "file=@invoice.pdf"`,
  },
  {
    method: "GET", path: "/api/public/v1/files/:id",
    desc: "Get file metadata and a short-lived signed download URL (60s).",
    sample: `curl https://cloud.egreedtech.org/api/public/v1/files/{id} \\
  -H "X-API-Key: eck_live_..."`,
  },
  {
    method: "DELETE", path: "/api/public/v1/files/:id",
    desc: "Delete a file permanently (removes from storage and frees quota).",
    sample: `curl -X DELETE https://cloud.egreedtech.org/api/public/v1/files/{id} \\
  -H "X-API-Key: eck_live_..."`,
  },
  {
    method: "POST", path: "/api/public/v1/files/:id/signed-url",
    desc: "Mint a time-limited signed download URL. expires_in is in seconds (30 – 604800, default 300). Response includes expires_in and the exact expires_at timestamp.",
    sample: `curl -X POST https://cloud.egreedtech.org/api/public/v1/files/{id}/signed-url \\
  -H "X-API-Key: eck_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"expires_in": 3600}'

# => { "download_url": "https://...", "expires_in": 3600,
#      "expires_at": "2026-08-02T23:59:00.000Z" }`,
  },
  {
    method: "POST", path: "/api/public/v1/files/upload-url",
    desc: "Mint a time-limited signed UPLOAD URL for direct-to-storage uploads (no proxy, no size limit on our side). PUT the bytes to upload_url, then call /files/commit.",
    sample: `curl -X POST https://cloud.egreedtech.org/api/public/v1/files/upload-url \\
  -H "X-API-Key: eck_live_..." -H "Content-Type: application/json" \\
  -d '{"filename":"scan.pdf","size":1048576,"expires_in":3600}'

curl -X PUT "<upload_url>" --data-binary @scan.pdf

curl -X POST https://cloud.egreedtech.org/api/public/v1/files/commit \\
  -H "X-API-Key: eck_live_..." -H "Content-Type: application/json" \\
  -d '{"storage_path":"<storage_path>","name":"scan.pdf"}'`,
  },
  {
    method: "POST", path: "/api/public/v1/uploads/init",
    desc: "Start a resumable chunked upload. Returns session_id, chunk_size, total_chunks and URL templates. PUT each chunk to /api/public/v1/uploads/:id/chunks/:index, GET the session for missing_chunks[] to resume, then POST /complete.",
    sample: `curl -X POST https://cloud.egreedtech.org/api/public/v1/uploads/init \\
  -H "X-API-Key: eck_live_..." -H "Content-Type: application/json" \\
  -d '{"filename":"video.mp4","size":52428800,"chunk_size":5242880}'`,
  },
  {
    method: "POST", path: "/api/public/v1/chat/:model",
    desc: "AI gateway — OpenAI-compatible chat completions proxied to your running deployment. Authenticate with a minted gateway key; rate limits and monthly token quotas are enforced.",
    sample: `curl -X POST https://cloud.egreedtech.org/api/public/v1/chat/{model-slug} \\
  -H "X-API-Key: eck_live_..." -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"hi"}]}'`,
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
        <h2 className="mb-2 font-display text-lg font-semibold">CORS</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Every <code className="font-mono text-xs">/api/public/v1/*</code> endpoint answers cross-origin
          requests (<code className="font-mono text-xs">OPTIONS</code> preflight included) and allows the
          <code className="font-mono text-xs"> X-API-Key</code>, <code className="font-mono text-xs">Authorization</code> and
          <code className="font-mono text-xs"> Content-Type</code> headers — so browser-side SDKs on any domain can call it directly.
        </p>
      </Card>

      <Card className="mt-8 p-6">
        <h2 className="mb-2 font-display text-lg font-semibold">Response format</h2>
        <p className="mb-3 text-sm text-muted-foreground">All responses are JSON. Errors return a non-2xx status code with <code className="font-mono text-xs">{`{ "error": "message" }`}</code>.</p>
      </Card>
    </div>
  );
}
