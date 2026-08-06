import { describe, expect, it } from "vitest";
import {
  parseListParams,
  slugifyClientId,
  toApiFile,
  filePermissions,
  escapeLikeTerm,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/lib/api-files";
import { checkRateLimit, rateLimitHeaders } from "@/lib/api-rate-limit";

describe("slugifyClientId", () => {
  it("slugifies a client name", () => {
    expect(slugifyClientId("Muhazi Clinic", "fallback")).toBe("muhazi-clinic");
  });
  it("falls back when nothing usable remains", () => {
    expect(slugifyClientId("!!!", "key-123")).toBe("key-123");
    expect(slugifyClientId(null, "key-123")).toBe("key-123");
  });
});

describe("parseListParams", () => {
  it("defaults to a safe window", () => {
    const p = parseListParams(new URLSearchParams());
    expect(p.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(p.offset).toBe(0);
    expect(p.search).toBeNull();
    expect(p.includeTrashed).toBe(false);
  });
  it("clamps oversized and invalid limits", () => {
    expect(parseListParams(new URLSearchParams("limit=99999")).limit).toBe(MAX_PAGE_SIZE);
    expect(parseListParams(new URLSearchParams("limit=abc")).limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListParams(new URLSearchParams("limit=-5")).limit).toBe(DEFAULT_PAGE_SIZE);
  });
  it("derives offset from page when offset is absent", () => {
    expect(parseListParams(new URLSearchParams("page=3&limit=10")).offset).toBe(20);
  });
  it("prefers an explicit offset and rejects negatives", () => {
    expect(parseListParams(new URLSearchParams("page=3&limit=10&offset=5")).offset).toBe(5);
    expect(parseListParams(new URLSearchParams("offset=-1")).offset).toBe(0);
  });
  it("supports search and q aliases", () => {
    expect(parseListParams(new URLSearchParams("search=report")).search).toBe("report");
    expect(parseListParams(new URLSearchParams("q=report")).search).toBe("report");
  });
});

describe("filePermissions", () => {
  it("maps scopes to resource permissions", () => {
    expect(filePermissions(["read", "download"])).toEqual(["read", "download"]);
    expect(filePermissions(["manage"])).toEqual(["manage", "delete"]);
    expect(filePermissions([])).toEqual([]);
  });
});

describe("escapeLikeTerm", () => {
  it("escapes wildcards so search cannot alter the pattern", () => {
    expect(escapeLikeTerm("100%_x")).toBe("100\\%\\_x");
  });
});

describe("toApiFile", () => {
  const row = {
    id: "f1",
    user_id: "user001",
    name: "document.pdf",
    size: "1024",
    mime_type: "application/pdf",
    folder_id: null,
    storage_path: "user001/abc-document.pdf",
    is_favorite: false,
    is_trashed: false,
    password_hash: null,
    pin_hash: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  };

  it("returns the documented ownership shape", () => {
    const f = toApiFile(row, { ownerId: "user001", clientId: "muhazi-clinic", scopes: ["read", "download"] });
    expect(f.file_id).toBe("f1");
    expect(f.owner_id).toBe("user001");
    expect(f.client_id).toBe("muhazi-clinic");
    expect(f.file_name).toBe("document.pdf");
    expect(f.file_type).toBe("application/pdf");
    expect(f.file_size).toBe(1024);
    expect(f.permissions).toEqual(["read", "download"]);
  });

  it("keeps legacy field names for backward compatibility", () => {
    const f = toApiFile(row, { ownerId: "user001", clientId: "c", scopes: ["read"] });
    expect(f.id).toBe("f1");
    expect(f.name).toBe("document.pdf");
    expect(f.size).toBe(1024);
    expect(f.mime_type).toBe("application/pdf");
  });

  it("flags locked files", () => {
    const locked = toApiFile({ ...row, pin_hash: "hash" }, { ownerId: "u", clientId: "c", scopes: ["read"] });
    expect(locked.is_locked).toBe(true);
  });
});

describe("rate limiting", () => {
  it("allows requests under the limit and blocks above it", () => {
    const key = `test-${Math.random()}`;
    expect(checkRateLimit(key, 2).allowed).toBe(true);
    expect(checkRateLimit(key, 2).allowed).toBe(true);
    const blocked = checkRateLimit(key, 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(rateLimitHeaders(blocked)["Retry-After"]).toBeDefined();
  });

  it("reports standard headers", () => {
    const res = checkRateLimit(`test-${Math.random()}`, 10);
    const headers = rateLimitHeaders(res);
    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("9");
  });
});
