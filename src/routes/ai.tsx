import { createFileRoute, Link } from "@tanstack/react-router";

const INTEGRATIONS: { name: string; how: string; snippet: string }[] = [
  {
    name: "ChatGPT / OpenAI API (function calling)",
    how: "Describe EGREED Cloud tools as OpenAI functions and forward the arguments to the REST API.",
    snippet: `const tools = [{
  type: "function",
  function: {
    name: "list_files",
    description: "List files in the user's EGREED Cloud account",
    parameters: { type: "object", properties: { folder: { type: "string" } } },
  },
}];

// When the model calls it:
const res = await fetch("https://cloud.egreedtech.org/api/public/v1/files", {
  headers: { "X-API-Key": process.env.EGREED_API_KEY },
});`,
  },
  {
    name: "Claude (tool use)",
    how: "Claude reads /llms.txt to learn the API, then calls it through your tool handler.",
    snippet: `tools: [{
  name: "upload_file",
  description: "Upload a file to EGREED Cloud (multipart, max 500MB)",
  input_schema: { type: "object", required: ["filename"], properties: {
    filename: { type: "string" }, folder: { type: "string" } } },
}]`,
  },
  {
    name: "Cursor / Lovable / Windsurf / Bolt / Copilot",
    how: "Paste the docs URL into the chat; these assistants fetch it and write working code.",
    snippet: `Use the EGREED Cloud API documented at
https://cloud.egreedtech.org/llms.txt
(OpenAPI: https://cloud.egreedtech.org/openapi.json)
Authenticate with header X-API-Key. Build an uploader component.`,
  },
  {
    name: "n8n",
    how: "Use the HTTP Request node with a header credential.",
    snippet: `Method: POST
URL: https://cloud.egreedtech.org/api/public/v1/files/upload
Authentication: Generic → Header Auth
  Name: X-API-Key   Value: eck_live_...
Body: form-data → field "file" = binary property "data"`,
  },
  {
    name: "Zapier / Make",
    how: "Use a Webhooks / HTTP module with a custom header.",
    snippet: `POST https://cloud.egreedtech.org/api/public/v1/files/upload
Headers: X-API-Key: eck_live_...
Body type: multipart/form-data, field "file"`,
  },
  {
    name: "LangChain (Python)",
    how: "Wrap the SDK methods as StructuredTools.",
    snippet: `from langchain_core.tools import tool
from egreed_cloud import EgreedCloud

cloud = EgreedCloud(api_key=os.environ["EGREED_API_KEY"])

@tool
def list_files() -> list:
    """List the user's files in EGREED Cloud."""
    return cloud.list_files()["files"]`,
  },
  {
    name: "LlamaIndex",
    how: "Load files as documents by downloading through signed URLs.",
    snippet: `link = cloud.signed_download_url(file_id, expires_in=600)["download_url"]
docs = SimpleWebPageReader().load_data([link])
index = VectorStoreIndex.from_documents(docs)`,
  },
  {
    name: "CrewAI / AutoGen",
    how: "Register the same functions as agent tools; agents share one scoped key.",
    snippet: `from crewai_tools import tool

@tool("upload_to_egreed")
def upload_to_egreed(path: str) -> str:
    """Upload a local file to EGREED Cloud and return its id."""
    return cloud.upload(path)["file"]["id"]`,
  },
  {
    name: "Model Context Protocol (MCP)",
    how: "Point any MCP-capable client at an HTTP bridge that maps MCP tools onto these endpoints. Tool surface: upload_file, download_file, delete_file, list_files, search_files, create_folder, move_file, rename_file, share_file, storage_usage, generate_link, get_metadata.",
    snippet: `{
  "mcpServers": {
    "egreed-cloud": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.egreedtech.org/mcp"],
      "env": { "EGREED_API_KEY": "eck_live_..." }
    }
  }
}`,
  },
];

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Integration Center — EGREED Cloud" },
      {
        name: "description",
        content:
          "Connect EGREED Cloud to ChatGPT, Claude, Gemini, Cursor, Lovable, n8n, Zapier, Make, LangChain, LlamaIndex, CrewAI and MCP clients.",
      },
      { property: "og:title", content: "EGREED Cloud AI Integration Center" },
      {
        property: "og:description",
        content: "Copy-paste recipes for wiring EGREED Cloud storage into AI assistants and agent frameworks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiCenterPage,
});

function AiCenterPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="font-display text-3xl font-bold">AI Integration Center</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            EGREED Cloud is designed to be readable by machines. Point any assistant at{" "}
            <a className="text-primary hover:underline" href="/llms.txt">
              /llms.txt
            </a>{" "}
            (plain-language API description) or{" "}
            <a className="text-primary hover:underline" href="/openapi.json">
              /openapi.json
            </a>{" "}
            and it can generate working integration code with a single scoped API key.
          </p>
          <nav className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link to="/docs" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Interactive docs
            </Link>
            <Link to="/playground" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Playground
            </Link>
            <Link to="/developers" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              Developer hub
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Agent-ready tool surface</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Whatever framework you use, expose these twelve operations and an agent can do everything a
            user can:
          </p>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            {[
              "upload_file",
              "download_file",
              "delete_file",
              "list_files",
              "search_files",
              "create_folder",
              "move_file",
              "rename_file",
              "share_file",
              "storage_usage",
              "generate_link",
              "get_metadata",
            ].map((t) => (
              <li key={t} className="rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Give agents the narrowest key possible: read-only agents get{" "}
            <code className="font-mono">read</code> + <code className="font-mono">download</code>; writing
            agents add <code className="font-mono">upload</code>; destructive actions need{" "}
            <code className="font-mono">manage</code>.
          </p>
        </section>

        {INTEGRATIONS.map((i) => (
          <section key={i.name} className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">{i.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{i.how}</p>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">{i.snippet}</pre>
          </section>
        ))}
      </main>
    </div>
  );
}
