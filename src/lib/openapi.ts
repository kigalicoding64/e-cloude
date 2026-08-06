import { API_ERROR_CODES, API_SCOPES, SCOPE_DESCRIPTIONS } from "@/lib/api-errors";

/** OpenAPI 3.1 document for the E-Cloud public API. */
export function buildOpenApiSpec(baseUrl = "https://cloud.egreedtech.org") {
  const err = {
    type: "object",
    required: ["error", "code", "status"],
    properties: {
      error: { type: "string" },
      code: { type: "string", enum: Object.keys(API_ERROR_CODES) },
      status: { type: "integer" },
      details: {},
      documentation_url: { type: "string" },
    },
  };
  const errorResponse = (description: string) => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  });
  const common = {
    "400": errorResponse("Validation or JSON error"),
    "401": errorResponse("Missing or invalid API key"),
    "403": errorResponse("Insufficient scope or locked file"),
    "404": errorResponse("Not found"),
    "409": errorResponse("Conflict (idempotency, incomplete upload)"),
    "413": errorResponse("Payload too large or quota exceeded"),
    "429": errorResponse("Rate limited or quota exhausted"),
    "500": errorResponse("Internal or storage error"),
  };
  const idem = {
    name: "Idempotency-Key",
    in: "header",
    required: false,
    schema: { type: "string", maxLength: 200 },
    description: "Retry-safe key. Repeating a request with the same key replays the original response.",
  };
  const ok = (description: string) => ({ description, content: { "application/json": { schema: { type: "object" } } } });

  return {
    openapi: "3.1.0",
    info: {
      title: "E-Cloud API",
      version: "1.1.0",
      description:
        "Cloud storage API for third-party apps. Authenticate with `X-API-Key: eck_live_...` " +
        "or `Authorization: Bearer eck_live_...`. " +
        "Keys carry fine-grained scopes: " +
        API_SCOPES.map((s) => `\`${s}\` — ${SCOPE_DESCRIPTIONS[s]}`).join("; ") + ". " +
        "Every endpoint is reachable on three interchangeable base URLs: `/api/v1`, `/api/files`-style " +
        "short paths, and the canonical `/api/public/v1`. All responses are JSON — HTML is never returned.",
    },
    servers: [
      { url: `${baseUrl}/api/v1`, description: "Versioned base URL (recommended)" },
      { url: `${baseUrl}/api/public/v1`, description: "Canonical always-public base URL" },
    ],
    components: {
      schemas: { Error: err },
      securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" } },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/": { get: { summary: "Discovery document", security: [], responses: { "200": ok("Discovery") } } },
      "/health": {
        get: {
          summary: "Health probe — api, database, storage and authentication status",
          security: [],
          responses: { "200": ok("Online"), "503": errorResponse("Degraded") },
        },
      },
      "/me": {
        get: {
          summary: "Account info and granted key permissions",
          tags: ["Account"],
          responses: { "200": ok("Account, quota and scopes"), ...common },
        },
      },
      "/files": {
        get: {
          summary: "List files assigned to the calling client (scope: read)",
          description:
            "Returns `{ success, client, client_id, owner_id, permissions, files[], pagination }`. " +
            "Each file includes file_id, owner_id, client_id, file_name, file_type, file_size and permissions. " +
            "When the client has no files the response is still 200 with an empty array and " +
            "`message: \"No files assigned\"`.",
          tags: ["Files"],
          parameters: [
            { name: "folder", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "search", in: "query", description: "Case-insensitive file name search", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", maximum: 200, default: 50 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
            { name: "page", in: "query", description: "1-based page, used when offset is omitted", schema: { type: "integer", default: 1 } },
            { name: "include_trashed", in: "query", schema: { type: "boolean", default: false } },
          ],
          responses: { "200": ok("File list"), ...common },
        },
      },
      "/files/upload": {
        post: {
          summary: "Direct upload, max 500MB (scope: upload)",
          tags: ["Files"],
          parameters: [idem],
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["file"],
                  properties: { file: { type: "string", format: "binary" }, folder: { type: "string" } },
                },
              },
            },
          },
          responses: { "201": ok("Created file"), ...common },
        },
      },
      "/files/upload-url": {
        post: {
          summary: "Mint a signed upload URL (scope: upload)",
          tags: ["Files"],
          parameters: [idem],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["filename"],
                  properties: {
                    filename: { type: "string" },
                    size: { type: "integer" },
                    mime_type: { type: "string" },
                    folder_id: { type: "string", format: "uuid" },
                    expires_in: { type: "integer", minimum: 30, maximum: 604800 },
                  },
                },
              },
            },
          },
          responses: { "201": ok("Signed upload target"), ...common },
        },
      },
      "/files/commit": {
        post: {
          summary: "Register a directly uploaded object (scope: upload)",
          tags: ["Files"],
          parameters: [idem],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["storage_path"],
                  properties: {
                    storage_path: { type: "string" },
                    name: { type: "string" },
                    folder_id: { type: "string", format: "uuid" },
                    mime_type: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "201": ok("Created file"), "200": ok("Already committed"), ...common },
        },
      },
      "/files/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { summary: "File metadata (scope: read; download URL needs download)", tags: ["Files"], responses: { "200": ok("File"), ...common } },
        patch: {
          summary: "Rename / move / favorite / trash (scope: manage)",
          tags: ["Files"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    folder_id: { type: ["string", "null"] },
                    is_favorite: { type: "boolean" },
                    is_trashed: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: { "200": ok("Updated file"), ...common },
        },
        delete: { summary: "Delete permanently (scope: manage)", tags: ["Files"], responses: { "200": ok("Deleted"), ...common } },
      },
      "/files/{id}/signed-url": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        post: {
          summary: "Mint a signed download URL (scope: download)",
          tags: ["Files"],
          requestBody: {
            content: {
              "application/json": {
                schema: { type: "object", properties: { expires_in: { type: "integer", minimum: 30, maximum: 604800 } } },
              },
            },
          },
          responses: { "200": ok("Signed download URL"), ...common },
        },
      },
      "/folders": {
        get: { summary: "List folders (scope: read)", tags: ["Folders"], responses: { "200": ok("Folders"), ...common } },
        post: {
          summary: "Create folder (scope: manage)",
          tags: ["Folders"],
          requestBody: {
            content: {
              "application/json": {
                schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, parent_id: { type: "string" } } },
              },
            },
          },
          responses: { "201": ok("Folder"), ...common },
        },
      },
      "/folders/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        patch: { summary: "Rename or move folder (scope: manage)", tags: ["Folders"], responses: { "200": ok("Folder"), ...common } },
        delete: { summary: "Delete empty folder (scope: manage)", tags: ["Folders"], responses: { "200": ok("Deleted"), ...common } },
      },
      "/uploads/init": {
        post: {
          summary: "Start resumable chunked upload (scope: upload)",
          tags: ["Chunked uploads"],
          parameters: [idem],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["filename", "size"],
                  properties: {
                    filename: { type: "string" },
                    size: { type: "integer" },
                    chunk_size: { type: "integer" },
                    mime_type: { type: "string" },
                    folder_id: { type: "string" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": ok("Session"), ...common },
        },
      },
      "/uploads/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { summary: "Session status with missing_chunks[] for resume (scope: read)", tags: ["Chunked uploads"], responses: { "200": ok("Session status"), ...common } },
        delete: { summary: "Abort session (scope: upload)", tags: ["Chunked uploads"], responses: { "200": ok("Aborted"), ...common } },
      },
      "/uploads/{id}/chunks/{index}": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "index", in: "path", required: true, schema: { type: "integer" } },
        ],
        put: {
          summary: "Upload one chunk — idempotent, safe to retry (scope: upload)",
          tags: ["Chunked uploads"],
          requestBody: { content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
          responses: { "200": ok("Chunk stored"), "410": errorResponse("Session expired"), ...common },
        },
      },
      "/uploads/{id}/complete": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        post: { summary: "Assemble chunks into a file (scope: upload)", tags: ["Chunked uploads"], responses: { "200": ok("Completed"), ...common } },
      },
      "/chat/{model}": {
        parameters: [{ name: "model", in: "path", required: true, schema: { type: "string" } }],
        post: { summary: "OpenAI-compatible chat completion via the AI gateway", tags: ["AI"], responses: { "200": ok("Completion"), ...common } },
      },
    },
  };
}
