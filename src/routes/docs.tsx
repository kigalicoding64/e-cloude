import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "EGREED Cloud API Docs — Interactive Reference" },
      {
        name: "description",
        content:
          "Interactive EGREED Cloud API reference: scoped API keys, uploads, resumable chunks, signed URLs, folders, webhooks and error codes.",
      },
      { property: "og:title", content: "EGREED Cloud API Docs" },
      {
        property: "og:description",
        content: "Try every EGREED Cloud endpoint from the browser — OpenAPI 3.1, dark mode, copyable examples.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1/dist/browser/standalone.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold">EGREED Cloud API</h1>
            <p className="text-sm text-muted-foreground">
              Interactive OpenAPI 3.1 reference — search, try requests, copy examples.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link to="/api-guide" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Usage guide
            </Link>
            <Link to="/playground" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Playground
            </Link>
            <Link to="/developers" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Developer hub
            </Link>
            <Link to="/ai" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              AI integrations
            </Link>
            <a href="/openapi.json" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              openapi.json
            </a>
            <a href="/openapi.yaml" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              openapi.yaml
            </a>
          </nav>
        </div>
      </header>

      {!loaded && (
        <p className="px-6 py-10 text-sm text-muted-foreground">Loading the interactive reference…</p>
      )}
      <script
        id="api-reference"
        type="application/json"
        data-url="/openapi.json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            spec: { url: "/openapi.json" },
            theme: "purple",
            darkMode: true,
            hideDownloadButton: false,
            searchHotKey: "k",
            authentication: { preferredSecurityScheme: "ApiKeyAuth" },
          }),
        }}
      />
      <noscript>
        <p className="p-6 text-sm">
          Enable JavaScript, or read the raw spec at <a href="/openapi.json">/openapi.json</a>.
        </p>
      </noscript>
    </div>
  );
}
