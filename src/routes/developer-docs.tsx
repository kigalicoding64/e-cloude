import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/developer-docs")({
  head: () => ({
    meta: [
      { title: "E-Cloud API Reference — Swagger Docs" },
      {
        name: "description",
        content:
          "Interactive OpenAPI reference for the E-Cloud storage API: scoped API keys, signed URLs, resumable uploads and error codes.",
      },
      { property: "og:title", content: "E-Cloud API Reference" },
      {
        property: "og:description",
        content: "Interactive OpenAPI/Swagger reference for the E-Cloud public storage API.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" }],
  }),
  component: DeveloperDocsPage,
});

function DeveloperDocsPage() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const w = window as unknown as { SwaggerUIBundle?: (o: unknown) => void };
      w.SwaggerUIBundle?.({
        url: "/api/public/v1/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        docExpansion: "list",
      });
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-5">
        <h1 className="font-display text-2xl font-bold">E-Cloud API reference</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Interactive OpenAPI 3.1 spec —{" "}
          <a className="text-primary hover:underline" href="/api/public/v1/openapi.json">
            download openapi.json
          </a>
          . Authenticate with <code className="font-mono text-xs">X-API-Key</code>; each key carries
          <code className="font-mono text-xs"> read</code>, <code className="font-mono text-xs">download</code>,{" "}
          <code className="font-mono text-xs">upload</code> and/or <code className="font-mono text-xs">manage</code> scopes.
        </p>
      </header>
      <div id="swagger-ui" className="bg-white" />
    </div>
  );
}
