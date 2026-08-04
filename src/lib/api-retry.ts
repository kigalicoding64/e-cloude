// Pure retry/backoff helpers for the resumable chunked upload flow.
// Used by the browser uploader and documented for third-party SDKs.

export const RETRYABLE_STATUSES = [408, 425, 429, 500, 502, 503, 504];

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.includes(status);
}

export type BackoffOptions = {
  baseMs?: number;
  maxMs?: number;
  /** Deterministic jitter factor in [0,1); omit for random jitter. */
  jitter?: number;
};

/** Exponential backoff with jitter. attempt is 0-based. */
export function backoffDelay(attempt: number, opts: BackoffOptions = {}): number {
  const base = opts.baseMs ?? 500;
  const max = opts.maxMs ?? 15_000;
  const raw = Math.min(max, base * 2 ** Math.max(0, attempt));
  const jitter = opts.jitter ?? Math.random();
  return Math.round(raw * (0.5 + 0.5 * jitter));
}

/** Chunk indices still needed, given what the server says it already has. */
export function missingChunks(totalChunks: number, uploaded: readonly number[]): number[] {
  const have = new Set(uploaded);
  const out: number[] = [];
  for (let i = 0; i < totalChunks; i++) if (!have.has(i)) out.push(i);
  return out;
}

export function chunkRange(index: number, chunkSize: number, totalSize: number) {
  const start = index * chunkSize;
  const end = Math.min(totalSize, start + chunkSize);
  return { start, end, length: Math.max(0, end - start) };
}

/** Stable idempotency key for a logical upload attempt. */
export function idempotencyKeyFor(parts: readonly (string | number)[]): string {
  return parts.map((p) => String(p).replace(/[^\w.\-:]/g, "_")).join(":").slice(0, 200);
}
