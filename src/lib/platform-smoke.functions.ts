// External-origin verification for EGREED Cloud:
//  1. signed download URL for a chosen file, fetched as an outside caller
//  2. full external-app smoke test (upload -> list -> download -> delete)
//
// Both are admin-only and never return secret values or the API key itself.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIVE_TARGETS } from "@/lib/platform-health";

const TIMEOUT_MS = 20_000;
const EXTERNAL_ORIGIN = "https://third-party.example";

export type CheckStep = {
  name: string;
  ok: boolean;
  status: number | null;
  detail: string;
  duration_ms: number;
};

export type SmokeTestResult = {
  target_label: string;
  base_url: string;
  passed: boolean;
  steps: CheckStep[];
  ran_at: string;
};

export type ExpiryReport = {
  ttl_seconds: number;
  issued_at: string;
  expected_expiry_at: string;
  fresh_ok: boolean;
  fresh_status: number | null;
  grace_probe_at: string;
  grace_offset_ms: number;
  grace_exercised: boolean; // link was still accepted inside the grace window
  grace_status: number | null;
  expired_probe_at: string;
  expired_refused: boolean;
  expired_status: number | null;
  observed: "refused_at_expiry" | "refused_after_grace" | "never_expired" | "inconclusive";
};

export type IntegrityReport = {
  expected_bytes: number;
  received_bytes: number;
  expected_sha256: string | null;
  received_sha256: string | null;
  checksum_match: boolean;
  expected_mime: string | null;
  content_type: string | null;
  content_type_ok: boolean;
  content_disposition: string | null;
  disposition_ok: boolean;
};

export type IsolationReport = {
  attempted: boolean;
  other_owner: boolean;
  other_owner_label: string | null;
  blocked: boolean;
  detail: string;
};

export type SignedDownloadCheck = {
  target_label: string;
  base_url: string;
  file_id: string;
  file_name: string;
  expires_at: string | null;
  requested_expires_in: number;
  passed: boolean;
  steps: CheckStep[];
  expiry: ExpiryReport | null;
  integrity: IntegrityReport | null;
  isolation: IsolationReport | null;
  ran_at: string;
};

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Administrator access required");
}

function resolveTarget(targetId?: string) {
  return LIVE_TARGETS.find((t) => t.id === targetId) ?? LIVE_TARGETS[0];
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const started = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - started };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Request failed", ms: Date.now() - started };
  }
}

async function sha256Bytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function req(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: { Origin: EXTERNAL_ORIGIN, Accept: "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Files owned by the signed-in admin, for picking one to verify. */
export const listOwnFilesForCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("files")
      .select("id, name, size, mime_type, password_hash, pin_hash")
      .eq("user_id", context.userId)
      .eq("is_trashed", false)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      size: Number(f.size ?? 0),
      mime_type: f.mime_type,
      locked: Boolean(f.password_hash || f.pin_hash),
    }));
  });

/**
 * Create a signed download URL for one file and prove an outside caller can
 * actually download the bytes from it.
 */
export const verifySignedDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      fileId: string;
      targetId?: string;
      apiKey?: string;
      foreignApiKey?: string;
      expiresIn?: number;
    }) => {
      if (!d?.fileId) throw new Error("Choose a file to verify");
      return d;
    },
  )
  .handler(async ({ data, context }): Promise<SignedDownloadCheck> => {
    await assertAdmin(context.userId);
    const target = resolveTarget(data.targetId);
    const apiKey = data.apiKey?.trim();
    const foreignKey = data.foreignApiKey?.trim();
    const expiresIn = Math.min(Math.max(Math.floor(data.expiresIn ?? 300), 60), 3600);
    const steps: CheckStep[] = [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file } = await supabaseAdmin
      .from("files")
      .select("id, name, size, mime_type, storage_path, password_hash, pin_hash, is_trashed")
      .eq("id", data.fileId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!file || file.is_trashed) throw new Error("That file is no longer available");

    const locked = Boolean(file.password_hash || file.pin_hash);
    let signedUrl: string | null = null;
    let expiresAt: string | null = null;
    let expiry: ExpiryReport | null = null;
    let integrity: IntegrityReport | null = null;
    let isolation: IsolationReport | null = null;

    if (apiKey) {
      const r = await timed(() =>
        req(`${target.baseUrl}/api/public/v1/files/${file.id}/signed-url`, {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ expires_in: expiresIn }),
        }),
      );
      const res = r.value;
      const body = res ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
      const nested = (body?.["data"] as Record<string, unknown> | undefined) ?? undefined;
      signedUrl =
        (nested?.["download_url"] as string | undefined) ??
        (body?.["download_url"] as string | undefined) ??
        null;
      expiresAt =
        (nested?.["expires_at"] as string | undefined) ??
        (body?.["expires_at"] as string | undefined) ??
        null;
      steps.push({
        name: "Create secure link through the public API",
        ok: Boolean(signedUrl),
        status: res?.status ?? null,
        detail: signedUrl
          ? `Link issued by ${target.label}, valid for ${expiresIn}s`
          : r.error ?? "The API did not return a download link",
        duration_ms: r.ms,
      });
    } else if (locked) {
      steps.push({
        name: "Create secure link",
        ok: false,
        status: null,
        detail: "This file is locked — unlock it before issuing a link",
        duration_ms: 0,
      });
    } else {
      const r = await timed(async () => {
        const signed = await supabaseAdmin.storage
          .from("user-files")
          .createSignedUrl(file.storage_path, expiresIn, { download: file.name });
        if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Signing failed");
        return signed.data.signedUrl;
      });
      signedUrl = r.value ?? null;
      expiresAt = signedUrl ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
      steps.push({
        name: "Create secure link",
        ok: Boolean(signedUrl),
        status: null,
        detail: signedUrl
          ? `Link created directly, valid for ${expiresIn}s`
          : r.error ?? "Could not create a link",
        duration_ms: r.ms,
      });
    }

    if (signedUrl) {
      // Original bytes straight from storage, for a checksum comparison.
      const original = await timed(async () => {
        const dl = await supabaseAdmin.storage.from("user-files").download(file.storage_path);
        if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "Could not read the stored file");
        return await dl.data.arrayBuffer();
      });
      const expectedSha = original.value ? await sha256Bytes(original.value) : null;
      const expectedBytes = original.value ? original.value.byteLength : Number(file.size ?? 0);

      // Fetch as an outside caller: no credentials, foreign Origin header.
      const r = await timed(() =>
        fetch(signedUrl!, {
          headers: { Origin: EXTERNAL_ORIGIN },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }),
      );
      const res = r.value;
      if (res) {
        const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
        const receivedSha = buf.byteLength > 0 ? await sha256Bytes(buf) : null;
        const contentType = res.headers.get("content-type");
        const contentDisposition = res.headers.get("content-disposition");
        const expectedMime = file.mime_type ?? null;
        const typeOk = expectedMime
          ? Boolean(contentType && contentType.split(";")[0]!.trim().toLowerCase() === expectedMime.toLowerCase())
          : Boolean(contentType);
        const dispositionOk = Boolean(
          contentDisposition &&
            /attachment/i.test(contentDisposition) &&
            contentDisposition.includes(file.name),
        );
        const checksumMatch = Boolean(expectedSha && receivedSha && expectedSha === receivedSha);
        const sizeOk = expectedBytes === 0 || buf.byteLength === expectedBytes;

        integrity = {
          expected_bytes: expectedBytes,
          received_bytes: buf.byteLength,
          expected_sha256: expectedSha,
          received_sha256: receivedSha,
          checksum_match: checksumMatch,
          expected_mime: expectedMime,
          content_type: contentType,
          content_type_ok: typeOk,
          content_disposition: contentDisposition,
          disposition_ok: dispositionOk,
        };

        steps.push({
          name: "Download from an external origin",
          ok: res.ok && buf.byteLength > 0 && sizeOk,
          status: res.status,
          detail: res.ok
            ? `Received ${buf.byteLength} bytes${expectedBytes ? ` of ${expectedBytes} expected` : ""}${sizeOk ? "" : " — size mismatch"}`
            : `The link was refused with status ${res.status}`,
          duration_ms: r.ms,
        });
        steps.push({
          name: "Downloaded contents match the original (SHA-256)",
          ok: checksumMatch,
          status: res.status,
          detail: checksumMatch
            ? `Checksum matches: ${expectedSha!.slice(0, 16)}…`
            : expectedSha && receivedSha
              ? "Checksums differ — the delivered file is not identical"
              : original.error ?? "Could not compare checksums",
          duration_ms: 0,
        });
        steps.push({
          name: "File type and download headers are correct",
          ok: typeOk && dispositionOk,
          status: res.status,
          detail: `Type: ${contentType ?? "missing"}${expectedMime ? ` (expected ${expectedMime})` : ""} · Filename header: ${
            contentDisposition ?? "missing"
          }`,
          duration_ms: 0,
        });
        steps.push({
          name: "Link is readable without a session",
          ok: res.ok,
          status: res.status,
          detail: res.ok
            ? "An unauthenticated outside caller could read the file"
            : "The outside caller was blocked",
          duration_ms: 0,
        });
      } else {
        steps.push({
          name: "Download from an external origin",
          ok: false,
          status: null,
          detail: r.error ?? "The download request failed",
          duration_ms: r.ms,
        });
      }

      // A tampered link must be refused.
      const tampered = signedUrl.replace(/(token=)([^&]+)/, (_m, p1: string, p2: string) => {
        const last = p2.slice(-1) === "a" ? "b" : "a";
        return `${p1}${p2.slice(0, -1)}${last}`;
      });
      const t = await timed(() =>
        fetch(tampered, { headers: { Origin: EXTERNAL_ORIGIN }, signal: AbortSignal.timeout(TIMEOUT_MS) }),
      );
      steps.push({
        name: "Altered link is rejected",
        ok: t.value ? !t.value.ok : false,
        status: t.value?.status ?? null,
        detail: t.value
          ? t.value.ok
            ? "A modified link still worked — this should not happen"
            : `Correctly refused with status ${t.value.status}`
          : t.error ?? "Check failed",
        duration_ms: t.ms,
      });
    }

    // Cross-tenant isolation: a key belonging to another organization must not
    // be able to read this file or mint a link for it.
    if (foreignKey) {
      let ownerLabel: string | null = null;
      let otherOwner = false;
      const me = await timed(() => req(`${target.baseUrl}/api/public/v1/me`, { headers: { "X-API-Key": foreignKey } }));
      const meBody = me.value ? ((await me.value.json().catch(() => null)) as Record<string, unknown> | null) : null;
      const meData = (meBody?.["data"] as Record<string, unknown> | undefined) ?? meBody ?? undefined;
      const foreignOwnerId =
        (meData?.["owner_id"] as string | undefined) ??
        (meData?.["user_id"] as string | undefined) ??
        (meData?.["id"] as string | undefined) ??
        null;
      const foreignOrg =
        (meData?.["organization"] as string | undefined) ??
        (meData?.["org_name"] as string | undefined) ??
        (meData?.["email"] as string | undefined) ??
        null;
      otherOwner = Boolean(foreignOwnerId && foreignOwnerId !== context.userId);
      ownerLabel = foreignOrg ?? (foreignOwnerId ? `account ${foreignOwnerId.slice(0, 8)}…` : null);
      steps.push({
        name: "Second key belongs to a different organization",
        ok: otherOwner,
        status: me.value?.status ?? null,
        detail: otherOwner
          ? `Key belongs to ${ownerLabel ?? "another account"}`
          : foreignOwnerId
            ? "That key belongs to the same account — use a key from another organization"
            : me.error ?? "Could not identify the key's owner",
        duration_ms: me.ms,
      });

      const readAttempt = await timed(() =>
        req(`${target.baseUrl}/api/public/v1/files/${file.id}`, { headers: { "X-API-Key": foreignKey } }),
      );
      const readBlocked = readAttempt.value ? !readAttempt.value.ok : false;
      steps.push({
        name: "Other organization cannot read the file",
        ok: readBlocked,
        status: readAttempt.value?.status ?? null,
        detail: readAttempt.value
          ? readBlocked
            ? `Correctly refused with status ${readAttempt.value.status}`
            : "The other organization could read this file — this should not happen"
          : readAttempt.error ?? "Check failed",
        duration_ms: readAttempt.ms,
      });

      const signAttempt = await timed(() =>
        req(`${target.baseUrl}/api/public/v1/files/${file.id}/signed-url`, {
          method: "POST",
          headers: { "X-API-Key": foreignKey, "Content-Type": "application/json" },
          body: JSON.stringify({ expires_in: 120 }),
        }),
      );
      const signBody = signAttempt.value
        ? ((await signAttempt.value.json().catch(() => null)) as Record<string, unknown> | null)
        : null;
      const leaked =
        ((signBody?.["data"] as Record<string, unknown> | undefined)?.["download_url"] as string | undefined) ??
        (signBody?.["download_url"] as string | undefined) ??
        null;
      const signBlocked = Boolean(signAttempt.value && !signAttempt.value.ok && !leaked);
      steps.push({
        name: "Other organization cannot mint a secure link",
        ok: signBlocked,
        status: signAttempt.value?.status ?? null,
        detail: signAttempt.value
          ? signBlocked
            ? `Correctly refused with status ${signAttempt.value.status}`
            : "A link was issued to the other organization — this should not happen"
          : signAttempt.error ?? "Check failed",
        duration_ms: signAttempt.ms,
      });

      isolation = {
        attempted: true,
        other_owner: otherOwner,
        other_owner_label: ownerLabel,
        blocked: readBlocked && signBlocked,
        detail:
          readBlocked && signBlocked
            ? "The other organization was blocked from both reading and signing"
            : "Cross-organization access was not fully blocked",
      };
    }

    // Expiry enforcement: issue a deliberately short-lived link and prove it
    // works now, is still tolerated inside a small clock-skew grace window,
    // and is refused well after the timeout.
    if (locked) {
      steps.push({
        name: "Link expiry check",
        ok: false,
        status: null,
        detail: "Skipped — this file is locked",
        duration_ms: 0,
      });
    } else {
      const SHORT_TTL_SECONDS = 2;
      const GRACE_MS = 1_500;
      const GRACE_OFFSET_MS = 250;
      const shortSign = await timed(async () => {
        const signed = await supabaseAdmin.storage
          .from("user-files")
          .createSignedUrl(file.storage_path, SHORT_TTL_SECONDS, { download: file.name });
        if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Signing failed");
        return signed.data.signedUrl;
      });
      const shortUrl = shortSign.value ?? null;
      const issuedAt = Date.now();

      if (!shortUrl) {
        steps.push({
          name: "Create a short-lived link for the expiry check",
          ok: false,
          status: null,
          detail: shortSign.error ?? "Could not create a short-lived link",
          duration_ms: shortSign.ms,
        });
      } else {
        const probe = () =>
          timed(() =>
            fetch(shortUrl, { headers: { Origin: EXTERNAL_ORIGIN }, signal: AbortSignal.timeout(TIMEOUT_MS) }),
          );

        // a) Works straight away.
        const fresh = await probe();
        steps.push({
          name: `Short-lived link (${SHORT_TTL_SECONDS}s) works immediately`,
          ok: Boolean(fresh.value?.ok),
          status: fresh.value?.status ?? null,
          detail: fresh.value?.ok
            ? "Downloaded successfully while still valid"
            : fresh.error ?? `Refused too early with status ${fresh.value?.status ?? "none"}`,
          duration_ms: fresh.ms,
        });

        // b) Grace-period edge case: just past the timeout.
        const graceTarget = issuedAt + SHORT_TTL_SECONDS * 1000 + GRACE_OFFSET_MS;
        await new Promise((r) => setTimeout(r, Math.max(0, graceTarget - Date.now())));
        const graceAt = new Date().toISOString();
        const grace = await probe();
        const graceRefused = grace.value ? !grace.value.ok : false;
        const graceExercised = Boolean(grace.value?.ok);
        steps.push({
          name: "Just past the timeout (grace window)",
          ok: Boolean(grace.value),
          status: grace.value?.status ?? null,
          detail: grace.value
            ? graceRefused
              ? `Already refused with status ${grace.value.status}`
              : "Still accepted inside the short grace window — acceptable clock tolerance"
            : grace.error ?? "Check failed",
          duration_ms: grace.ms,
        });

        // c) Well after the timeout it must fail.
        const hardTarget = issuedAt + SHORT_TTL_SECONDS * 1000 + GRACE_MS + 1_500;
        await new Promise((r) => setTimeout(r, Math.max(0, hardTarget - Date.now())));
        const expiredAt = new Date().toISOString();
        const expired = await probe();
        const expiredRefused = expired.value ? !expired.value.ok : false;
        steps.push({
          name: "Expired link is refused after the timeout",
          ok: expiredRefused,
          status: expired.value?.status ?? null,
          detail: expired.value
            ? expired.value.ok
              ? "The link still worked after expiry — this should not happen"
              : `Correctly refused with status ${expired.value.status}`
            : expired.error ?? "Check failed",
          duration_ms: expired.ms,
        });

        expiry = {
          ttl_seconds: SHORT_TTL_SECONDS,
          issued_at: new Date(issuedAt).toISOString(),
          expected_expiry_at: new Date(issuedAt + SHORT_TTL_SECONDS * 1000).toISOString(),
          fresh_ok: Boolean(fresh.value?.ok),
          fresh_status: fresh.value?.status ?? null,
          grace_probe_at: graceAt,
          grace_offset_ms: GRACE_OFFSET_MS,
          grace_exercised: graceExercised,
          grace_status: grace.value?.status ?? null,
          expired_probe_at: expiredAt,
          expired_refused: expiredRefused,
          expired_status: expired.value?.status ?? null,
          observed: !expired.value
            ? "inconclusive"
            : !expiredRefused
              ? "never_expired"
              : graceExercised
                ? "refused_after_grace"
                : "refused_at_expiry",
        };
      }
    }

    return {
      target_label: target.label,
      base_url: target.baseUrl,
      file_id: file.id,
      file_name: file.name,
      expires_at: expiresAt,
      requested_expires_in: expiresIn,
      passed: steps.length > 0 && steps.every((s) => s.ok),
      steps,
      expiry,
      integrity,
      isolation,
      ran_at: new Date().toISOString(),
    };
  });

/**
 * Full external-app smoke test with a real API key: upload a tiny file, list
 * it, download it from an external origin, delete it, and confirm CORS plus
 * permission enforcement.
 */
export const runExternalAppSmokeTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apiKey: string; targetId?: string }) => {
    if (!d?.apiKey?.trim()) throw new Error("An API key is required for the smoke test");
    return d;
  })
  .handler(async ({ data, context }): Promise<SmokeTestResult> => {
    await assertAdmin(context.userId);
    const target = resolveTarget(data.targetId);
    const key = data.apiKey.trim();
    const base = target.baseUrl;
    const steps: CheckStep[] = [];
    const push = (s: CheckStep) => steps.push(s);

    // 1. CORS preflight from a foreign origin.
    {
      const r = await timed(() =>
        req(`${base}/api/public/v1/files`, {
          method: "OPTIONS",
          headers: {
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-api-key, content-type",
          },
        }),
      );
      const allowOrigin = r.value?.headers.get("access-control-allow-origin") ?? null;
      push({
        name: "Cross-origin permission (preflight)",
        ok: Boolean(r.value && r.value.status < 400 && allowOrigin),
        status: r.value?.status ?? null,
        detail: allowOrigin
          ? `Outside apps are allowed (origin: ${allowOrigin})`
          : r.error ?? "No cross-origin permission returned",
        duration_ms: r.ms,
      });
    }

    // 2. Invalid key must be rejected with JSON.
    {
      const r = await timed(() =>
        req(`${base}/api/public/v1/files`, { headers: { "X-API-Key": "eck_live_invalid_probe_key" } }),
      );
      const res = r.value;
      const text = res ? await res.text().catch(() => "") : "";
      let json = false;
      try {
        json = typeof JSON.parse(text) === "object";
      } catch {
        json = false;
      }
      const rejected = res ? res.status === 401 || res.status === 403 : false;
      push({
        name: "Invalid key refused",
        ok: rejected && json,
        status: res?.status ?? null,
        detail: rejected
          ? json
            ? "Rejected with a clear JSON error"
            : "Rejected, but the error was not JSON"
          : r.error ?? `Unexpected status ${res?.status ?? "none"}`,
        duration_ms: r.ms,
      });
    }

    // 3. Upload a tiny file.
    const stamp = Date.now();
    const fileName = `smoke-test-${stamp}.txt`;
    const content = `EGREED Cloud smoke test ${new Date(stamp).toISOString()}\n`;
    const expectedBytes = new TextEncoder().encode(content).length;
    let fileId: string | null = null;
    {
      const form = new FormData();
      form.append("file", new File([content], fileName, { type: "text/plain" }));
      const r = await timed(() =>
        req(`${base}/api/public/v1/files/upload`, {
          method: "POST",
          headers: { "X-API-Key": key },
          body: form,
        }),
      );
      const res = r.value;
      const body = res ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
      const nested = (body?.["data"] as Record<string, unknown> | undefined) ?? undefined;
      fileId =
        (nested?.["id"] as string | undefined) ??
        (nested?.["file_id"] as string | undefined) ??
        (body?.["id"] as string | undefined) ??
        (body?.["file_id"] as string | undefined) ??
        null;
      push({
        name: "Upload a small test file",
        ok: Boolean(fileId),
        status: res?.status ?? null,
        detail: fileId
          ? `Uploaded ${fileName} (${expectedBytes} bytes)`
          : r.error ?? "Upload did not return a file reference",
        duration_ms: r.ms,
      });
    }

    // 4. List and find it.
    if (fileId) {
      const r = await timed(() =>
        req(`${base}/api/public/v1/files?limit=50`, { headers: { "X-API-Key": key } }),
      );
      const res = r.value;
      const body = res ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
      const rows =
        (body?.["files"] as Array<Record<string, unknown>> | undefined) ??
        (body?.["data"] as Array<Record<string, unknown>> | undefined) ??
        [];
      const found = rows.some((row) => row["file_id"] === fileId || row["id"] === fileId);
      push({
        name: "List files and find the new one",
        ok: Boolean(res?.ok && found),
        status: res?.status ?? null,
        detail: found
          ? `Listing returned the uploaded file among ${rows.length} entries`
          : r.error ?? "The uploaded file was not in the listing",
        duration_ms: r.ms,
      });
    }

    // 5. Signed link + external download.
    if (fileId) {
      const r = await timed(() =>
        req(`${base}/api/public/v1/files/${fileId}/signed-url`, {
          method: "POST",
          headers: { "X-API-Key": key, "Content-Type": "application/json" },
          body: JSON.stringify({ expires_in: 120 }),
        }),
      );
      const res = r.value;
      const body = res ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null;
      const nested = (body?.["data"] as Record<string, unknown> | undefined) ?? undefined;
      const url =
        (nested?.["download_url"] as string | undefined) ??
        (body?.["download_url"] as string | undefined) ??
        null;
      push({
        name: "Request a secure download link",
        ok: Boolean(url),
        status: res?.status ?? null,
        detail: url ? "Link issued" : r.error ?? "No link returned",
        duration_ms: r.ms,
      });

      if (url) {
        const d = await timed(() =>
          fetch(url, { headers: { Origin: EXTERNAL_ORIGIN }, signal: AbortSignal.timeout(TIMEOUT_MS) }),
        );
        const dres = d.value;
        const text = dres ? await dres.text().catch(() => "") : "";
        push({
          name: "Download the file from an external origin",
          ok: Boolean(dres?.ok) && text === content,
          status: dres?.status ?? null,
          detail: dres?.ok
            ? text === content
              ? `Downloaded ${expectedBytes} bytes, contents match exactly`
              : "Downloaded, but the contents did not match"
            : d.error ?? `Download refused with status ${dres?.status ?? "none"}`,
          duration_ms: d.ms,
        });
      }
    }

    // 6. Delete it again (cleanup + permission check).
    if (fileId) {
      const r = await timed(() =>
        req(`${base}/api/public/v1/files/${fileId}`, {
          method: "DELETE",
          headers: { "X-API-Key": key },
        }),
      );
      const res = r.value;
      push({
        name: "Delete the test file",
        ok: Boolean(res?.ok),
        status: res?.status ?? null,
        detail: res?.ok
          ? "Test file removed — nothing left behind"
          : res?.status === 403
            ? "This key does not have permission to delete (manage scope missing)"
            : r.error ?? `Delete failed with status ${res?.status ?? "none"}`,
        duration_ms: r.ms,
      });

      const check = await timed(() =>
        req(`${base}/api/public/v1/files/${fileId}`, { headers: { "X-API-Key": key } }),
      );
      push({
        name: "Deleted file is gone",
        ok: check.value?.status === 404,
        status: check.value?.status ?? null,
        detail:
          check.value?.status === 404
            ? "The file can no longer be read"
            : `Still reachable with status ${check.value?.status ?? "none"}`,
        duration_ms: check.ms,
      });
    }

    return {
      target_label: target.label,
      base_url: base,
      passed: steps.every((s) => s.ok),
      steps,
      ran_at: new Date().toISOString(),
    };
  });
