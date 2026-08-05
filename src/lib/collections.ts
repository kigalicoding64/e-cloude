// Generates importable API client collections (Postman / Insomnia / Bruno)
// straight from the OpenAPI document so they never drift from the spec.
import { buildOpenApiSpec } from "@/lib/openapi";

type Op = { method: string; path: string; summary: string };

export function listOperations(baseUrl: string): Op[] {
  const spec = buildOpenApiSpec(baseUrl) as unknown as {
    paths: Record<string, Record<string, { summary?: string }>>;
  };
  const ops: Op[] = [];
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      ops.push({ method: method.toUpperCase(), path, summary: op.summary ?? `${method} ${path}` });
    }
  }
  return ops;
}

const AUTH_HEADER = { key: "X-API-Key", value: "{{apiKey}}" };

export function buildPostmanCollection(baseUrl: string) {
  const server = `${baseUrl}/api/public/v1`;
  return {
    info: {
      name: "EGREED Cloud API",
      description:
        "EGREED Cloud storage API. Set the `apiKey` variable to a key created in the dashboard (API Keys).",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: server },
      { key: "apiKey", value: "eck_live_xxx" },
    ],
    item: listOperations(baseUrl).map((op) => ({
      name: op.summary,
      request: {
        method: op.method,
        header: [AUTH_HEADER, { key: "Content-Type", value: "application/json" }],
        url: {
          raw: `{{baseUrl}}${op.path}`,
          host: ["{{baseUrl}}"],
          path: op.path.split("/").filter(Boolean),
        },
        ...(op.method === "GET" || op.method === "DELETE"
          ? {}
          : { body: { mode: "raw", raw: "{}" } }),
      },
    })),
  };
}

export function buildInsomniaCollection(baseUrl: string) {
  const server = `${baseUrl}/api/public/v1`;
  const now = Date.now();
  return {
    _type: "export",
    __export_format: 4,
    __export_source: "egreed-cloud",
    __export_date: new Date().toISOString(),
    resources: [
      { _id: "wrk_egreed", _type: "workspace", name: "EGREED Cloud API", scope: "collection" },
      {
        _id: "env_egreed",
        _type: "environment",
        parentId: "wrk_egreed",
        name: "Base",
        data: { baseUrl: server, apiKey: "eck_live_xxx" },
      },
      ...listOperations(baseUrl).map((op, i) => ({
        _id: `req_${i}`,
        _type: "request",
        parentId: "wrk_egreed",
        modified: now,
        created: now,
        name: op.summary,
        method: op.method,
        url: `{{ baseUrl }}${op.path}`,
        headers: [
          { name: "X-API-Key", value: "{{ apiKey }}" },
          { name: "Content-Type", value: "application/json" },
        ],
        body:
          op.method === "GET" || op.method === "DELETE"
            ? {}
            : { mimeType: "application/json", text: "{}" },
      })),
    ],
  };
}

export function buildBrunoCollection(baseUrl: string) {
  const server = `${baseUrl}/api/public/v1`;
  return {
    name: "EGREED Cloud API",
    version: "1",
    type: "collection",
    environments: [
      { name: "Base", variables: [{ name: "baseUrl", value: server }, { name: "apiKey", value: "eck_live_xxx" }] },
    ],
    items: listOperations(baseUrl).map((op, seq) => ({
      type: "http",
      name: op.summary,
      seq: seq + 1,
      request: {
        url: `{{baseUrl}}${op.path}`,
        method: op.method,
        headers: [
          { name: "X-API-Key", value: "{{apiKey}}", enabled: true },
          { name: "Content-Type", value: "application/json", enabled: true },
        ],
        auth: { mode: "none" },
        body: op.method === "GET" || op.method === "DELETE" ? { mode: "none" } : { mode: "json", json: "{}" },
      },
    })),
  };
}
