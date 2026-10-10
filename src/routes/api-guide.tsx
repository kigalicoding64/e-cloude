import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { buildApiGuideMarkdown } from "@/lib/api-guide";
import { PUBLIC_BASE_URL } from "@/lib/site";

export const Route = createFileRoute("/api-guide")({
  head: () => ({
    meta: [
      { title: "How to Use the EGREED Cloud API — Step-by-Step Guide" },
      {
        name: "description",
        content:
          "Public step-by-step guide to the EGREED Cloud API: get a key, authenticate, upload, download with signed URLs, manage files — readable by humans and AI models.",
      },
      { property: "og:title", content: "How to Use the EGREED Cloud API" },
      {
        property: "og:description",
        content:
          "Copy-paste ready guide: API keys, scopes, uploads, resumable chunks, signed download URLs, error codes and AI-assistant prompts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApiGuidePage,
});

/** Render the shared Markdown guide as simple, readable HTML sections. */
function renderMarkdown(md: string) {
  const blocks: ReactNode[] = [];
  const lines = md.split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++} className="overflow-auto rounded-md bg-muted p-3 text-xs" data-lang={lang}>
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key++} className="font-display text-3xl font-bold">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={key++} className="mt-8 border-t border-border pt-6 font-display text-xl font-semibold">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("> ")) {
      blocks.push(
        <p key={key++} className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">
          {line.slice(2)}
        </p>,
      );
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(lines[i++].slice(2));
      i--;
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 pl-5 text-sm">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      i--;
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1 pl-5 text-sm">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ol>,
      );
    } else if (line.trim() === "") {
      // skip
    } else {
      blocks.push(
        <p key={key++} className="text-sm leading-6 text-foreground/90">
          {renderInline(line)}
        </p>,
      );
    }
    i++;
  }
  return blocks;
}

function renderInline(text: string): (string | ReactNode)[] {
  // Render `code` spans; keep the rest as plain text.
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

function ApiGuidePage() {
  const md = buildApiGuideMarkdown();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Public guide — also available as Markdown for AI models at{" "}
            <a className="text-primary hover:underline" href="/api-guide.md">
              /api-guide.md
            </a>
          </p>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link to="/docs" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Interactive docs
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
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-3 px-6 py-10">
        {renderMarkdown(md)}
        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Point an AI assistant at this API</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Paste this into ChatGPT, Claude, Cursor, Lovable or Copilot and it can write working
            integration code:
          </p>
          <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">{`Use the EGREED Cloud API documented at ${PUBLIC_BASE_URL}/llms.txt
(OpenAPI: ${PUBLIC_BASE_URL}/openapi.json, guide: ${PUBLIC_BASE_URL}/api-guide.md)
Authenticate with header X-API-Key. Build an uploader that lists files
and downloads them via signed URLs.`}</pre>
        </section>
      </main>
    </div>
  );
}
