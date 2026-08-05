import { createFileRoute, Link } from "@tanstack/react-router";

const RESOURCES = [
  { title: "Quick start", body: "Create a scoped key, upload a file and mint a signed link in three calls.", to: "/developer" as const },
  { title: "Interactive docs", body: "Every endpoint with search, dark mode and live try-it requests.", to: "/docs" as const },
  { title: "Playground", body: "Send real requests from the browser and copy generated snippets.", to: "/playground" as const },
  { title: "AI integrations", body: "ChatGPT, Claude, Cursor, n8n, Zapier, LangChain, MCP recipes.", to: "/ai" as const },
  { title: "API keys", body: "Create, scope, rename and revoke keys; review last use.", to: "/api-keys" as const },
  { title: "Usage & logs", body: "Requests, storage, bandwidth and error history for your account.", to: "/storage-analytics" as const },
];

const DOWNLOADS = [
  { label: "OpenAPI 3.1 (JSON)", href: "/openapi.json" },
  { label: "OpenAPI 3.1 (YAML)", href: "/openapi.yaml" },
  { label: "Postman collection", href: "/postman.json" },
  { label: "Insomnia collection", href: "/insomnia.json" },
  { label: "Bruno collection", href: "/bruno.json" },
  { label: "Service manifest", href: "/.well-known/egreed-cloud.json" },
  { label: "LLM-ready docs (llms.txt)", href: "/llms.txt" },
  { label: "JavaScript / TypeScript SDK", href: "/sdk/egreed-cloud.js" },
  { label: "Python SDK", href: "/sdk/egreed_cloud.py" },
];

const EXAMPLES: { lang: string; code: string }[] = [
  {
    lang: "cURL",
    code: `curl -X POST https://cloud.egreedtech.org/api/public/v1/files/upload \\
  -H "X-API-Key: eck_live_xxx" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -F "file=@./invoice.pdf"`,
  },
  {
    lang: "JavaScript / TypeScript",
    code: `import { EgreedCloud } from "./egreed-cloud.js";

const cloud = new EgreedCloud({ apiKey: process.env.EGREED_API_KEY });
const { file } = await cloud.upload(blob, { filename: "invoice.pdf" });
const { download_url } = await cloud.signedDownloadUrl(file.id, 600);`,
  },
  {
    lang: "React",
    code: `function Uploader({ cloud }) {
  return (
    <input
      type="file"
      onChange={async (e) => {
        const file = e.target.files[0];
        const res = await cloud.upload(file);
        console.log(res.file.id);
      }}
    />
  );
}`,
  },
  {
    lang: "Next.js (route handler)",
    code: `export async function POST(req) {
  const form = await req.formData();
  const upstream = await fetch("https://cloud.egreedtech.org/api/public/v1/files/upload", {
    method: "POST",
    headers: { "X-API-Key": process.env.EGREED_API_KEY },
    body: form,
  });
  return new Response(await upstream.text(), { status: upstream.status });
}`,
  },
  {
    lang: "Node.js",
    code: `const form = new FormData();
form.append("file", new Blob([buffer]), "report.csv");
const res = await fetch("https://cloud.egreedtech.org/api/public/v1/files/upload", {
  method: "POST",
  headers: { "X-API-Key": process.env.EGREED_API_KEY },
  body: form,
});`,
  },
  {
    lang: "Python",
    code: `from egreed_cloud import EgreedCloud

cloud = EgreedCloud(api_key=os.environ["EGREED_API_KEY"])
created = cloud.upload("invoice.pdf")
print(cloud.signed_download_url(created["file"]["id"], 600)["download_url"])`,
  },
  {
    lang: "PHP / Laravel",
    code: `$response = Http::withHeaders(['X-API-Key' => env('EGREED_API_KEY')])
    ->attach('file', file_get_contents($path), 'invoice.pdf')
    ->post('https://cloud.egreedtech.org/api/public/v1/files/upload');

$fileId = $response->json('file.id');`,
  },
  {
    lang: "Go",
    code: `req, _ := http.NewRequest("GET", "https://cloud.egreedtech.org/api/public/v1/files", nil)
req.Header.Set("X-API-Key", os.Getenv("EGREED_API_KEY"))
res, err := http.DefaultClient.Do(req)`,
  },
  {
    lang: "Java (Spring)",
    code: `HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("https://cloud.egreedtech.org/api/public/v1/me"))
    .header("X-API-Key", System.getenv("EGREED_API_KEY"))
    .build();
HttpClient.newHttpClient().send(req, BodyHandlers.ofString());`,
  },
  {
    lang: "C# / ASP.NET",
    code: `using var client = new HttpClient();
client.DefaultRequestHeaders.Add("X-API-Key", Environment.GetEnvironmentVariable("EGREED_API_KEY"));
var json = await client.GetStringAsync("https://cloud.egreedtech.org/api/public/v1/files");`,
  },
  {
    lang: "Rust",
    code: `let res = reqwest::Client::new()
    .get("https://cloud.egreedtech.org/api/public/v1/files")
    .header("X-API-Key", std::env::var("EGREED_API_KEY")?)
    .send()
    .await?;`,
  },
  {
    lang: "Flutter / Dart",
    code: `final req = http.MultipartRequest('POST',
    Uri.parse('https://cloud.egreedtech.org/api/public/v1/files/upload'))
  ..headers['X-API-Key'] = apiKey
  ..files.add(await http.MultipartFile.fromPath('file', path));
final res = await req.send();`,
  },
  {
    lang: "Swift",
    code: `var req = URLRequest(url: URL(string: "https://cloud.egreedtech.org/api/public/v1/me")!)
req.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
let (data, _) = try await URLSession.shared.data(for: req)`,
  },
  {
    lang: "Kotlin",
    code: `val request = Request.Builder()
    .url("https://cloud.egreedtech.org/api/public/v1/files")
    .header("X-API-Key", apiKey)
    .build()
client.newCall(request).execute()`,
  },
  {
    lang: "PowerShell",
    code: `Invoke-RestMethod -Uri "https://cloud.egreedtech.org/api/public/v1/me" \`
  -Headers @{ "X-API-Key" = $env:EGREED_API_KEY }`,
  },
];

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developer Hub — EGREED Cloud API, SDKs & Collections" },
      {
        name: "description",
        content:
          "Everything to build on EGREED Cloud: OpenAPI spec, SDK downloads, Postman/Insomnia/Bruno collections, code examples in 15 languages and API key management.",
      },
      { property: "og:title", content: "EGREED Cloud Developer Hub" },
      {
        property: "og:description",
        content: "OpenAPI spec, SDKs, collections and copy-paste examples for the EGREED Cloud storage API.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevelopersPage,
});

function DevelopersPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-medium text-primary">Developer platform</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Build on EGREED Cloud</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            A REST API for storage: scoped keys, direct and resumable uploads, signed time-limited links,
            folders, sharing and an AI gateway. CORS is open, errors are machine-readable, and every
            endpoint is described in OpenAPI 3.1.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <Link to="/docs" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
              Open interactive docs
            </Link>
            <Link to="/playground" className="rounded-md border border-border px-4 py-2 hover:bg-muted">
              Try the playground
            </Link>
            <Link to="/api-keys" className="rounded-md border border-border px-4 py-2 hover:bg-muted">
              Create an API key
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <section>
          <h2 className="font-display text-xl font-semibold">Start here</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RESOURCES.map((r) => (
              <Link
                key={r.title}
                to={r.to}
                className="rounded-xl border border-border bg-card p-5 transition hover:border-primary/50 hover:shadow-sm"
              >
                <h3 className="font-medium">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Specs, SDKs & collections</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DOWNLOADS.map((d) => (
              <a
                key={d.href}
                href={d.href}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-muted"
              >
                <span>{d.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{d.href}</span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Generated SDKs cover authentication, upload (direct + resumable), download, delete, list,
            search, share links and folder operations. Collections import straight into Postman, Insomnia
            or Bruno — set the <code className="font-mono">apiKey</code> variable and go.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Authentication</h2>
          <div className="mt-3 rounded-xl border border-border bg-card p-5 text-sm">
            <p>
              Send <code className="font-mono">X-API-Key: eck_live_...</code> (or{" "}
              <code className="font-mono">Authorization: Bearer eck_live_...</code>) on every request. Keys
              are hashed at rest, revocable, and carry explicit scopes:
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              <li className="rounded-md bg-muted px-3 py-2">
                <code className="font-mono text-xs">read</code> — list & read metadata
              </li>
              <li className="rounded-md bg-muted px-3 py-2">
                <code className="font-mono text-xs">download</code> — mint signed download links
              </li>
              <li className="rounded-md bg-muted px-3 py-2">
                <code className="font-mono text-xs">upload</code> — direct, signed and chunked uploads
              </li>
              <li className="rounded-md bg-muted px-3 py-2">
                <code className="font-mono text-xs">manage</code> — rename, move, trash, delete
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              Call <code className="font-mono">GET /me</code> to see exactly what the current key may do.
              Rate limits and monthly quotas are enforced per key; watch{" "}
              <code className="font-mono">X-RateLimit-Remaining</code> and honour{" "}
              <code className="font-mono">Retry-After</code> on 429.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Error format</h2>
          <pre className="mt-3 overflow-auto rounded-xl border border-border bg-muted p-4 text-xs">{`{
  "success": false,
  "error": "This API key is missing the 'upload' scope.",
  "code": "insufficient_scope",
  "status": 403,
  "hint": "Mint a new key with the required scope, or widen the scopes on this key.",
  "request_id": "req_9f1c...",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "documentation_url": "https://cloud.egreedtech.org/docs"
}`}</pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Branch on <code className="font-mono">code</code>, never on the message. Quote{" "}
            <code className="font-mono">request_id</code> (also returned as the{" "}
            <code className="font-mono">X-Request-Id</code> header) in support requests.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Observability</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            {[
              ["Liveness", "/api/public/v1/live"],
              ["Readiness", "/api/public/v1/ready"],
              ["Health", "/api/public/v1/health"],
              ["Metrics", "/api/public/v1/metrics"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted">
                <span className="block font-medium">{label}</span>
                <span className="font-mono text-xs text-muted-foreground">{href}</span>
              </a>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Code examples</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Copy any snippet and swap in your key. All examples target{" "}
            <code className="font-mono text-xs">/api/public/v1</code>.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {EXAMPLES.map((e) => (
              <div key={e.lang} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{e.lang}</h3>
                  <button
                    onClick={() => navigator.clipboard?.writeText(e.code)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Copy
                  </button>
                </div>
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs">{e.code}</pre>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Versioning & compatibility</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            The current stable version is <code className="font-mono">v1</code> at{" "}
            <code className="font-mono">/api/public/v1</code>. Additive changes (new fields, new endpoints)
            ship inside v1 without notice; breaking changes will only appear under a new prefix such as{" "}
            <code className="font-mono">/api/public/v2</code>, with a migration guide and a deprecation
            window announced through the discovery document and{" "}
            <a className="text-primary hover:underline" href="/.well-known/egreed-cloud.json">
              service manifest
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
