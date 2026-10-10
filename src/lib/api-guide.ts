import { PUBLIC_BASE_URL } from "@/lib/site";

/**
 * Single source of truth for the public "How to use the EGREED Cloud API" guide.
 * Rendered as a page at /api-guide and served as Markdown at /api-guide.md so
 * AI models (ChatGPT, Claude, Cursor, Lovable, Copilot...) can ingest it directly.
 */
export function buildApiGuideMarkdown(): string {
  const base = PUBLIC_BASE_URL;
  const api = `${base}/api/public/v1`;
  return `# How to use the EGREED Cloud API

> Step-by-step guide for developers and AI models. Everything below is copy-paste ready.
> Base URL for every call: ${api}

## 1. Get an API key
1. Sign in to ${base}
2. Open the dashboard → "API Keys"
3. Create a key and choose its scopes:
   - \`read\` — list files and folders, read metadata
   - \`download\` — mint signed download URLs
   - \`upload\` — upload files (direct or resumable)
   - \`manage\` — rename, move, delete files and folders
4. Copy the key. It looks like \`eck_live_xxxxxxxxxxxx\`. Keep it secret.

## 2. Authenticate every request
Send the key in a header on every call. Two equivalent forms:

    X-API-Key: eck_live_xxxxxxxxxxxx

or

    Authorization: Bearer eck_live_xxxxxxxxxxxx

No cookies, no CSRF token. CORS is open for all origins, so browsers, servers,
n8n, Zapier and AI agents can all call the API directly.

Check your key and its permissions:

    GET ${api}/me

Returns your account, storage quota, \`scopes\`, \`permissions\` and a \`can\` map
(e.g. \`"can": { "upload": true, "manage": false }\`).

## 3. Upload a file (small, one request)
\`\`\`bash
curl -X POST ${api}/files/upload \\
  -H "X-API-Key: eck_live_xxxxxxxxxxxx" \\
  -F "file=@/path/to/document.pdf"
\`\`\`
- Multipart form field name: \`file\`
- Optional field \`folder\`: a folder UUID
- Optional header \`Idempotency-Key: <uuid>\` makes retries safe
- Max size: 500 MB
- Response \`201\` contains the created file record, including \`id\`

JavaScript:
\`\`\`js
const form = new FormData();
form.append("file", fileInput.files[0]);
const res = await fetch("${api}/files/upload", {
  method: "POST",
  headers: { "X-API-Key": key },
  body: form,
});
const { file } = await res.json();
\`\`\`

Python:
\`\`\`python
import requests
r = requests.post("${api}/files/upload",
    headers={"X-API-Key": key},
    files={"file": open("document.pdf", "rb")})
file = r.json()["file"]
\`\`\`

## 4. Upload a large file (resumable chunks)
1. Start a session:
   \`POST ${api}/uploads/init\` with JSON
   \`{"filename":"video.mp4","size":123456789,"chunk_size":8388608}\`
   → returns \`session_id\`, \`chunk_size\`, \`total_chunks\`
2. Send each chunk (any order, retry-safe):
   \`PUT ${api}/uploads/{session_id}/chunks/{index}\` with the raw bytes
3. After a failure, ask what is missing:
   \`GET ${api}/uploads/{session_id}\` → \`missing_chunks\` array
4. Assemble the file:
   \`POST ${api}/uploads/{session_id}/complete\` → the file record
5. Give up instead: \`DELETE ${api}/uploads/{session_id}\`

## 5. List and search files
\`\`\`bash
curl "${api}/files?limit=50&offset=0" -H "X-API-Key: eck_live_xxx"
curl "${api}/files?folder=<folder-uuid>" -H "X-API-Key: eck_live_xxx"
curl "${api}/folders" -H "X-API-Key: eck_live_xxx"
\`\`\`

## 6. Download a file (signed URL)
Downloads use short-lived signed URLs — mint one, then fetch it:
\`\`\`bash
curl -X POST ${api}/files/<file-id>/signed-url \\
  -H "X-API-Key: eck_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"expires_in":300}'
# → { "download_url": "https://..." }  (valid 5 minutes)
curl -O "<download_url>"   # no API key needed on the signed URL itself
\`\`\`

## 7. Manage files and folders
- \`PATCH /files/{id}\` — rename, move, favorite, trash (scope: manage)
- \`DELETE /files/{id}\` — delete permanently (scope: manage)
- \`POST /folders\` — create folder, body \`{"name":"Invoices","parent_id":null}\`
- \`PATCH /folders/{id}\` / \`DELETE /folders/{id}\` — rename/move, delete empty folder
- \`GET /shares/{token}\` — resolve a public share link (no auth)

## 8. Errors — always the same shape
\`\`\`json
{
  "success": false,
  "error": "human readable message",
  "code": "insufficient_scope",
  "status": 403,
  "hint": "Mint a new key with the required scope",
  "request_id": "req_...",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
\`\`\`
Branch on \`code\`, never on the message text. Common codes:
\`invalid_api_key\` (401), \`insufficient_scope\` (403), \`not_found\` (404),
\`conflict\` (409), \`file_too_large\` (413), \`rate_limited\` (429).

## 9. Rate limits
Responses may carry \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`,
\`X-Quota-Remaining\` and \`Retry-After\`. On 429, back off exponentially and
honour \`Retry-After\`.

## 10. For AI models and coding assistants
Machine-readable entry points (no auth needed):
- LLM guide: ${base}/llms.txt
- This guide as Markdown: ${base}/api-guide.md
- OpenAPI 3.1: ${base}/openapi.json or ${base}/openapi.yaml
- Service manifest: ${base}/.well-known/egreed-cloud.json
- API discovery: ${api}/
- Postman / Insomnia / Bruno: ${base}/postman.json, /insomnia.json, /bruno.json

Prompt you can paste into any AI assistant:

    Use the EGREED Cloud API documented at ${base}/llms.txt
    (OpenAPI: ${base}/openapi.json). Authenticate with header X-API-Key.
    Build an uploader that lists files and downloads them via signed URLs.

Ready-made SDKs: ${base}/sdk/egreed-cloud.js (JavaScript) and
${base}/sdk/egreed_cloud.py (Python). Interactive docs: ${base}/docs —
playground: ${base}/playground — integration recipes: ${base}/ai.
`;
}
