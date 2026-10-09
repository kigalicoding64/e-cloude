import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

type Op = { id: string; method: string; path: string; label: string; scope?: string; body?: string; multipart?: boolean };

const OPS: Op[] = [
  { id: "me", method: "GET", path: "/me", label: "Account, quota & key scopes" },
  { id: "health", method: "GET", path: "/health", label: "Health check (no auth)" },
  { id: "metrics", method: "GET", path: "/metrics", label: "Service metrics (no auth)" },
  { id: "files", method: "GET", path: "/files?limit=20", label: "List files", scope: "read" },
  { id: "file", method: "GET", path: "/files/{id}", label: "Get file metadata", scope: "read" },
  { id: "upload", method: "POST", path: "/files/upload", label: "Upload a file", scope: "upload", multipart: true },
  {
    id: "signed",
    method: "POST",
    path: "/files/{id}/signed-url",
    label: "Mint signed download URL",
    scope: "download",
    body: '{\n  "expires_in": 300\n}',
  },
  {
    id: "patch",
    method: "PATCH",
    path: "/files/{id}",
    label: "Rename / move / favorite / trash",
    scope: "manage",
    body: '{\n  "name": "renamed.pdf"\n}',
  },
  { id: "delete", method: "DELETE", path: "/files/{id}", label: "Delete file", scope: "manage" },
  { id: "folders", method: "GET", path: "/folders", label: "List folders", scope: "read" },
  {
    id: "folderNew",
    method: "POST",
    path: "/folders",
    label: "Create folder",
    scope: "manage",
    body: '{\n  "name": "Invoices"\n}',
  },
];

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "EGREED Cloud API Playground — Test Endpoints Live" },
      {
        name: "description",
        content:
          "Run live EGREED Cloud API requests from your browser: upload, list, share and delete files, then copy the generated code snippet.",
      },
      { property: "og:title", content: "EGREED Cloud API Playground" },
      { property: "og:description", content: "Test EGREED Cloud endpoints live and copy ready-made code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const [apiKey, setApiKey] = useState("");
  const [opId, setOpId] = useState("me");
  const [fileId, setFileId] = useState("");
  const [body, setBody] = useState(OPS[0]?.body ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseHeaders, setResponseHeaders] = useState<[string, string][]>([]);
  const [lang, setLang] = useState<"curl" | "js" | "python">("curl");

  const op = useMemo(() => OPS.find((o) => o.id === opId) ?? OPS[0]!, [opId]);
  const base = `${PUBLIC_BASE_URL}/api/public/v1`;
  const resolvedPath = op.path.replace("{id}", fileId || "FILE_ID");
  const url = `${base}${resolvedPath}`;

  const snippet = useMemo(() => {
    const keyLabel = apiKey ? apiKey : "eck_live_xxx";
    if (lang === "curl") {
      const parts = [`curl -X ${op.method} "${url}"`, `  -H "X-API-Key: ${keyLabel}"`];
      if (op.multipart) parts.push(`  -F "file=@./example.pdf"`);
      else if (op.body) parts.push(`  -H "Content-Type: application/json"`, `  -d '${body.replace(/\n\s*/g, " ")}'`);
      return parts.join(" \\\n");
    }
    if (lang === "js") {
      if (op.multipart)
        return `const form = new FormData();\nform.append("file", file);\n\nconst res = await fetch("${url}", {\n  method: "POST",\n  headers: { "X-API-Key": "${keyLabel}" },\n  body: form,\n});\nconsole.log(await res.json());`;
      return `const res = await fetch("${url}", {\n  method: "${op.method}",\n  headers: {\n    "X-API-Key": "${keyLabel}",\n    "Content-Type": "application/json",\n  },${op.body ? `\n  body: JSON.stringify(${body.replace(/\n\s*/g, " ")}),` : ""}\n});\nconsole.log(await res.json());`;
    }
    if (op.multipart)
      return `import requests\n\nres = requests.post(\n    "${url}",\n    headers={"X-API-Key": "${keyLabel}"},\n    files={"file": open("example.pdf", "rb")},\n)\nprint(res.json())`;
    return `import requests\n\nres = requests.request(\n    "${op.method}",\n    "${url}",\n    headers={"X-API-Key": "${keyLabel}"},${op.body ? `\n    json=${body.replace(/\n\s*/g, " ")},` : ""}\n)\nprint(res.json())`;
  }, [lang, op, url, apiKey, body]);

  async function send() {
    setBusy(true);
    setResponseText("");
    setStatus(null);
    setResponseHeaders([]);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers["X-API-Key"] = apiKey;
      let payload: BodyInit | undefined;
      if (op.multipart) {
        if (!file) throw new Error("Choose a file to upload first.");
        const form = new FormData();
        form.append("file", file);
        payload = form;
      } else if (op.body) {
        headers["Content-Type"] = "application/json";
        payload = body;
      }
      const res = await fetch(url, { method: op.method, headers, body: payload });
      setStatus(res.status);
      setResponseHeaders([...res.headers.entries()]);
      const text = await res.text();
      try {
        setResponseText(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponseText(text);
      }
    } catch (e) {
      setResponseText(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-2xl font-bold">API Playground</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Run real requests against your account. Create a scoped key in{" "}
            <Link to="/api-keys" className="text-primary hover:underline">
              API Keys
            </Link>
            , paste it below, then pick an endpoint. Requests run from your browser — your key never
            leaves this page except as the <code className="font-mono text-xs">X-API-Key</code> header.
          </p>
          <nav className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link to="/docs" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Interactive docs
            </Link>
            <Link to="/developers" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Developer hub
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Request</h2>

          <label className="block text-sm font-medium">
            API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="eck_live_..."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Endpoint
            <select
              value={opId}
              onChange={(e) => {
                const next = OPS.find((o) => o.id === e.target.value);
                setOpId(e.target.value);
                setBody(next?.body ?? "");
              }}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {OPS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.method} {o.path} — {o.label}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-muted-foreground">
            {op.scope ? `Requires the "${op.scope}" scope.` : "No scope required."} URL:{" "}
            <code className="font-mono">{url}</code>
          </p>

          {op.path.includes("{id}") && (
            <label className="block text-sm font-medium">
              File ID
              <input
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                placeholder="uuid from GET /files"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              />
            </label>
          )}

          {op.multipart && (
            <label className="block text-sm font-medium">
              File
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          )}

          {op.body !== undefined && (
            <label className="block text-sm font-medium">
              JSON body
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              />
            </label>
          )}

          <button
            onClick={send}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send request"}
          </button>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Response</h2>
              {status !== null && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    status < 400 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                  }`}
                >
                  HTTP {status}
                </span>
              )}
            </div>
            <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
              {responseText || "No request sent yet."}
            </pre>
            {responseHeaders.length > 0 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Response headers</summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {responseHeaders.map(([k, v]) => (
                    <li key={k}>
                      <span className="text-muted-foreground">{k}:</span> {v}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Code snippet</h2>
              <div className="flex gap-1 text-xs">
                {(["curl", "js", "python"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`rounded-md px-2.5 py-1 ${lang === l ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}
                  >
                    {l === "js" ? "JavaScript" : l === "curl" ? "cURL" : "Python"}
                  </button>
                ))}
                <button
                  onClick={() => navigator.clipboard?.writeText(snippet)}
                  className="rounded-md border border-border px-2.5 py-1 hover:bg-muted"
                >
                  Copy
                </button>
              </div>
            </div>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">{snippet}</pre>
          </div>
        </section>
      </main>
    </div>
  );
}
