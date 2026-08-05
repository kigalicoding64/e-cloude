// Source text for the downloadable official SDKs. Kept as plain strings so the
// same content powers /sdk/*.js|.py|.ts downloads and the copy-paste snippets.

export const JS_SDK = `/**
 * EGREED Cloud — official JavaScript / TypeScript SDK (zero dependencies).
 * Works in browsers, Node 18+, Deno, Bun and Cloudflare Workers.
 *
 *   import { EgreedCloud } from "./egreed-cloud.js";
 *   const cloud = new EgreedCloud({ apiKey: "eck_live_..." });
 *   const { files } = await cloud.listFiles();
 */
export class EgreedCloudError extends Error {
  constructor(body, status) {
    super(body?.error || \`EGREED Cloud request failed (\${status})\`);
    this.name = "EgreedCloudError";
    this.code = body?.code;
    this.status = status;
    this.requestId = body?.request_id;
    this.hint = body?.hint;
    this.body = body;
  }
}

export class EgreedCloud {
  constructor({ apiKey, baseUrl = "https://cloud.egreedtech.org/api/public/v1", fetch: f } = {}) {
    if (!apiKey) throw new Error("apiKey is required");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\\/$/, "");
    this.fetch = f || globalThis.fetch.bind(globalThis);
  }

  async request(path, { method = "GET", body, headers = {}, idempotencyKey, retries = 2 } = {}) {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const init = {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(isForm || body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: isForm || typeof body === "string" || body instanceof Uint8Array || body instanceof ArrayBuffer ? body : JSON.stringify(body) }),
    };
    let attempt = 0;
    for (;;) {
      const res = await this.fetch(\`\${this.baseUrl}\${path}\`, init);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500 + Math.random() * 250;
          await new Promise((r) => setTimeout(r, wait));
          attempt++;
          continue;
        }
      }
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new EgreedCloudError(data, res.status);
      return data;
    }
  }

  /* Account */
  me() { return this.request("/me"); }
  health() { return this.request("/health"); }

  /* Files */
  listFiles({ folder, limit = 50, offset = 0 } = {}) {
    const q = new URLSearchParams();
    if (folder) q.set("folder", folder);
    q.set("limit", String(limit));
    q.set("offset", String(offset));
    return this.request(\`/files?\${q}\`);
  }
  getFile(id) { return this.request(\`/files/\${id}\`); }
  updateFile(id, patch) { return this.request(\`/files/\${id}\`, { method: "PATCH", body: patch }); }
  deleteFile(id) { return this.request(\`/files/\${id}\`, { method: "DELETE" }); }
  renameFile(id, name) { return this.updateFile(id, { name }); }
  moveFile(id, folderId) { return this.updateFile(id, { folder_id: folderId }); }
  trashFile(id) { return this.updateFile(id, { is_trashed: true }); }
  favoriteFile(id, value = true) { return this.updateFile(id, { is_favorite: value }); }

  /** Upload a File/Blob directly (<= 500MB). */
  upload(file, { folder, filename, idempotencyKey } = {}) {
    const form = new FormData();
    form.append("file", file, filename || file.name || "upload.bin");
    if (folder) form.append("folder", folder);
    return this.request("/files/upload", { method: "POST", body: form, idempotencyKey });
  }
  createUploadUrl(input) { return this.request("/files/upload-url", { method: "POST", body: input }); }
  commitUpload(input) { return this.request("/files/commit", { method: "POST", body: input }); }
  signedDownloadUrl(id, expiresIn = 300) {
    return this.request(\`/files/\${id}/signed-url\`, { method: "POST", body: { expires_in: expiresIn } });
  }
  /** Convenience: mint a link and fetch the bytes. */
  async download(id) {
    const { download_url } = await this.signedDownloadUrl(id);
    const res = await this.fetch(download_url);
    if (!res.ok) throw new EgreedCloudError({ error: "Download failed" }, res.status);
    return res.blob();
  }
  async search(term, opts = {}) {
    const { files = [] } = await this.listFiles({ limit: 200, ...opts });
    const q = String(term).toLowerCase();
    return files.filter((f) => String(f.name).toLowerCase().includes(q));
  }

  /* Folders */
  listFolders() { return this.request("/folders"); }
  createFolder(name, parentId) { return this.request("/folders", { method: "POST", body: { name, parent_id: parentId } }); }
  updateFolder(id, patch) { return this.request(\`/folders/\${id}\`, { method: "PATCH", body: patch }); }
  deleteFolder(id) { return this.request(\`/folders/\${id}\`, { method: "DELETE" }); }

  /* Resumable uploads */
  async uploadLarge(file, { folder, chunkSize = 8 * 1024 * 1024, onProgress } = {}) {
    const session = await this.request("/uploads/init", {
      method: "POST",
      body: { filename: file.name, size: file.size, chunk_size: chunkSize, mime_type: file.type, folder_id: folder },
    });
    const total = session.total_chunks ?? Math.ceil(file.size / chunkSize);
    for (let i = 0; i < total; i++) {
      const blob = file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize));
      await this.request(\`/uploads/\${session.id}/chunks/\${i}\`, {
        method: "PUT",
        body: await blob.arrayBuffer(),
        headers: { "Content-Type": "application/octet-stream" },
      });
      onProgress?.({ uploaded: i + 1, total });
    }
    return this.request(\`/uploads/\${session.id}/complete\`, { method: "POST" });
  }
  uploadStatus(id) { return this.request(\`/uploads/\${id}\`); }
  abortUpload(id) { return this.request(\`/uploads/\${id}\`, { method: "DELETE" }); }
}

export default EgreedCloud;
`;

export const PY_SDK = `"""EGREED Cloud — official Python SDK (requests only).

    from egreed_cloud import EgreedCloud
    cloud = EgreedCloud(api_key="eck_live_...")
    print(cloud.me())
"""
from __future__ import annotations

import time
import random
from typing import Any, Optional

import requests

DEFAULT_BASE_URL = "https://cloud.egreedtech.org/api/public/v1"


class EgreedCloudError(Exception):
    def __init__(self, body: dict[str, Any] | None, status: int):
        super().__init__((body or {}).get("error") or f"EGREED Cloud request failed ({status})")
        self.code = (body or {}).get("code")
        self.status = status
        self.request_id = (body or {}).get("request_id")
        self.hint = (body or {}).get("hint")
        self.body = body


class EgreedCloud:
    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL, timeout: int = 60):
        if not api_key:
            raise ValueError("api_key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()

    def request(self, path: str, method: str = "GET", json: Any = None, data: Any = None,
                files: Any = None, idempotency_key: Optional[str] = None, retries: int = 2) -> Any:
        headers = {"X-API-Key": self.api_key}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        attempt = 0
        while True:
            res = self.session.request(method, f"{self.base_url}{path}", json=json, data=data,
                                       files=files, headers=headers, timeout=self.timeout)
            if (res.status_code == 429 or res.status_code >= 500) and attempt < retries:
                retry_after = res.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else 0.5 * (2 ** attempt) + random.random() * 0.25
                time.sleep(wait)
                attempt += 1
                continue
            body = res.json() if res.content else None
            if not res.ok:
                raise EgreedCloudError(body, res.status_code)
            return body

    # Account
    def me(self): return self.request("/me")
    def health(self): return self.request("/health")

    # Files
    def list_files(self, folder: Optional[str] = None, limit: int = 50, offset: int = 0):
        q = f"?limit={limit}&offset={offset}" + (f"&folder={folder}" if folder else "")
        return self.request("/files" + q)

    def get_file(self, file_id: str): return self.request(f"/files/{file_id}")
    def update_file(self, file_id: str, **patch): return self.request(f"/files/{file_id}", "PATCH", json=patch)
    def delete_file(self, file_id: str): return self.request(f"/files/{file_id}", "DELETE")
    def rename_file(self, file_id: str, name: str): return self.update_file(file_id, name=name)
    def move_file(self, file_id: str, folder_id: Optional[str]): return self.update_file(file_id, folder_id=folder_id)

    def upload(self, path: str, folder: Optional[str] = None, idempotency_key: Optional[str] = None):
        with open(path, "rb") as fh:
            data = {"folder": folder} if folder else None
            return self.request("/files/upload", "POST", files={"file": fh}, data=data,
                                idempotency_key=idempotency_key)

    def signed_download_url(self, file_id: str, expires_in: int = 300):
        return self.request(f"/files/{file_id}/signed-url", "POST", json={"expires_in": expires_in})

    def download(self, file_id: str, dest: str):
        url = self.signed_download_url(file_id)["download_url"]
        with requests.get(url, stream=True, timeout=self.timeout) as r:
            r.raise_for_status()
            with open(dest, "wb") as fh:
                for chunk in r.iter_content(1024 * 256):
                    fh.write(chunk)
        return dest

    def search(self, term: str):
        files = self.list_files(limit=200).get("files", [])
        return [f for f in files if term.lower() in str(f.get("name", "")).lower()]

    # Folders
    def list_folders(self): return self.request("/folders")
    def create_folder(self, name: str, parent_id: Optional[str] = None):
        return self.request("/folders", "POST", json={"name": name, "parent_id": parent_id})
    def delete_folder(self, folder_id: str): return self.request(f"/folders/{folder_id}", "DELETE")

    # Resumable upload
    def upload_large(self, path: str, chunk_size: int = 8 * 1024 * 1024, folder: Optional[str] = None):
        import os
        size = os.path.getsize(path)
        session = self.request("/uploads/init", "POST", json={
            "filename": os.path.basename(path), "size": size,
            "chunk_size": chunk_size, "folder_id": folder,
        })
        sid = session["id"]
        with open(path, "rb") as fh:
            index = 0
            while True:
                chunk = fh.read(chunk_size)
                if not chunk:
                    break
                self.request(f"/uploads/{sid}/chunks/{index}", "PUT", data=chunk)
                index += 1
        return self.request(f"/uploads/{sid}/complete", "POST")
`;
