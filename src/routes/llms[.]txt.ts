import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, corsPreflight } from "@/lib/cors";
import { API_SCOPES, SCOPE_DESCRIPTIONS, API_ERROR_CODES } from "@/lib/api-errors";

// GET /llms.txt -> compact, unambiguous API description written for LLMs and
// AI coding assistants (Cursor, Lovable, Claude Code, ChatGPT, Copilot, ...).
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        void request; const base = PUBLIC_BASE_URL;
        const api = `${base}/api/public/v1`;
        const body = `# EGREED Cloud (E-Cloud)

> Cloud storage platform with an API-first backend. Third-party apps upload,
> manage, share and retrieve files with scoped API keys.

Base URL: ${api}
OpenAPI JSON: ${base}/openapi.json
OpenAPI YAML: ${base}/openapi.yaml
Interactive docs: ${base}/docs
Usage guide (Markdown, AI-friendly): ${base}/api-guide.md
Playground: ${base}/playground
Postman: ${base}/postman.json  Insomnia: ${base}/insomnia.json  Bruno: ${base}/bruno.json
MCP server (for AI assistants): ${base}/mcp

## MCP server (AI assistants)
AI assistants (Claude, ChatGPT, etc.) can connect directly to the MCP endpoint:

    ${base}/mcp

Authentication is OAuth 2.1: the assistant opens a sign-in + consent page, the
user approves, and the assistant then acts as that user (their files only).
No API key is needed for MCP. Available tools: list_files, list_folders,
create_folder, get_download_link, trash_file.

## Authentication
Send an API key on every request (create one in the dashboard under "API Keys"):

    X-API-Key: eck_live_xxx

An equivalent form is supported: \`Authorization: Bearer eck_live_xxx\`.
Keys are hashed at rest and can be revoked at any time. No cookies, no CSRF token
required. CORS is enabled for all origins and OPTIONS preflight is supported.

## Scopes
Every key carries an explicit set of scopes. A call without the needed scope
returns HTTP 403 with code \`insufficient_scope\`.
${API_SCOPES.map((s) => `- ${s}: ${SCOPE_DESCRIPTIONS[s]}`).join("\n")}

Check what the current key may do: \`GET /me\` (returns \`scopes\`, \`permissions\`, \`can\`).

## Endpoints
GET    /                              Discovery document (no auth)
GET    /health                        Liveness + database reachability (no auth)
GET    /live                          Liveness probe (no auth)
GET    /ready                         Readiness probe (no auth)
GET    /metrics                       Service metrics, JSON (no auth)
GET    /me                            Account, storage quota, key scopes
GET    /files?folder=&limit=&offset=  List files (scope: read)
GET    /files/{id}                    File metadata (scope: read)
PATCH  /files/{id}                    Rename / move / favorite / trash (scope: manage)
DELETE /files/{id}                    Delete permanently (scope: manage)
POST   /files/upload                  Direct multipart upload, max 500MB (scope: upload)
POST   /files/upload-url              Mint a signed upload URL (scope: upload)
POST   /files/commit                  Register an object uploaded via signed URL (scope: upload)
POST   /files/{id}/signed-url         Mint a signed, time-limited download URL (scope: download)
GET    /folders                       List folders (scope: read)
POST   /folders                       Create folder (scope: manage)
PATCH  /folders/{id}                  Rename / move folder (scope: manage)
DELETE /folders/{id}                  Delete empty folder (scope: manage)
POST   /uploads/init                  Start resumable chunked upload (scope: upload)
PUT    /uploads/{id}/chunks/{index}   Upload one chunk, idempotent (scope: upload)
GET    /uploads/{id}                  Session status incl. missing_chunks[] (scope: read)
POST   /uploads/{id}/complete         Assemble chunks into a file (scope: upload)
DELETE /uploads/{id}                  Abort session (scope: upload)
GET    /shares/{token}                Resolve a public share link (no auth)
POST   /chat/{model}                  OpenAI-compatible chat completion (AI gateway key)

## Workflow: upload a small file
1. POST ${api}/files/upload with header \`X-API-Key\` and multipart body field \`file\`
   (optional \`folder\` = folder UUID). Add \`Idempotency-Key: <uuid>\` to make retries safe.
2. Response 201 contains the created file record, including \`id\`.
3. POST ${api}/files/{id}/signed-url with \`{"expires_in":300}\` to obtain \`download_url\`.

## Workflow: upload a large file (resumable)
1. POST /uploads/init  {"filename":"video.mp4","size":123456789,"chunk_size":8388608}
2. PUT  /uploads/{id}/chunks/{index} with the raw bytes of each chunk (any order, retry safe).
3. GET  /uploads/{id} -> \`missing_chunks\` tells you what to resend after a failure.
4. POST /uploads/{id}/complete -> the assembled file record.

## Errors
Every error uses the same JSON envelope:

    {
      "success": false,
      "error": "human readable message",
      "code": "insufficient_scope",
      "status": 403,
      "hint": "Mint a new key with the required scope",
      "request_id": "req_...",
      "timestamp": "2026-01-01T00:00:00.000Z",
      "documentation_url": "${base}/docs"
    }

Branch on \`code\`, not on the message text. Known codes:
${Object.entries(API_ERROR_CODES).map(([c, s]) => `- ${c} (${s})`).join("\n")}

## Rate limits and quotas
Per-key rate limits and monthly quotas are enforced. Responses may include
\`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-Quota-Remaining\` and \`Retry-After\`.
On 429 back off exponentially and honour \`Retry-After\`.

## Example (cURL)
    curl -s ${api}/me -H "X-API-Key: eck_live_xxx"

## Example (JavaScript)
    const res = await fetch("${api}/files", { headers: { "X-API-Key": key } });
    const { files } = await res.json();

## Example (Python)
    import requests
    r = requests.get("${api}/files", headers={"X-API-Key": key})
    r.raise_for_status()
`;
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=600",
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});
