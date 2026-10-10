import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, corsPreflight } from "@/lib/cors";
import { buildApiGuideMarkdown } from "@/lib/api-guide";

// GET /api-guide.md -> the full "How to use the API" guide as plain Markdown,
// so AI models and coding assistants can fetch and ingest it directly.
export const Route = createFileRoute("/api-guide.md")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async () =>
        new Response(buildApiGuideMarkdown(), {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=600",
            ...CORS_HEADERS,
          },
        }),
    },
  },
});
