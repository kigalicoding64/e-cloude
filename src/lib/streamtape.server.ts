// Streamtape video storage helpers (server only). Credentials come from
// STREAMTAPE_LOGIN / STREAMTAPE_KEY secrets; the admin switch lives in app_settings.
const API = "https://api.streamtape.com";

export function streamtapeCreds() {
  const login = process.env["STREAMTAPE_LOGIN"];
  const key = process.env["STREAMTAPE_KEY"];
  return login && key ? { login, key } : null;
}

export async function streamtapeEnabled(): Promise<boolean> {
  if (!streamtapeCreds()) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "streamtape").maybeSingle();
  return !!(data?.value as any)?.enabled;
}

export function isVideo(mime: string | null | undefined, name = "") {
  return (mime ?? "").startsWith("video/") || /\.(mp4|mkv|mov|avi|webm|m4v|flv|wmv)$/i.test(name);
}

async function call(path: string, params: Record<string, string>) {
  const c = streamtapeCreds();
  if (!c) throw new Error("Streamtape is not configured");
  const qs = new URLSearchParams({ login: c.login, key: c.key, ...params });
  const res = await fetch(`${API}${path}?${qs}`);
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { throw new Error(`Streamtape error [${res.status}]: ${text.slice(0, 200)}`); }
  if (body.status !== 200) throw new Error(`Streamtape error [${body.status}]: ${body.msg}`);
  return body.result;
}

export async function streamtapeUpload(file: File) {
  const { url } = await call("/file/ul", {});
  const fd = new FormData();
  fd.append("file1", file, file.name);
  const res = await fetch(url, { method: "POST", body: fd });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { throw new Error(`Streamtape upload failed [${res.status}]`); }
  if (body.status !== 200 || !body.result?.id) throw new Error(`Streamtape upload failed: ${body.msg ?? res.status}`);
  return { id: String(body.result.id), url: String(body.result.url ?? "") };
}

export async function streamtapeDownloadUrl(id: string): Promise<string> {
  const t = await call("/file/dlticket", { file: id });
  const wait = Math.min(Number(t.wait_time ?? 0), 10);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait * 1000 + 200));
  const d = await call("/file/dl", { file: id, ticket: t.ticket });
  return String(d.url);
}

export async function streamtapeCheck() {
  const r = await call("/account/info", {});
  return { email: r?.email ?? null };
}

export const streamtapeEmbedUrl = (id: string) => `https://streamtape.com/e/${encodeURIComponent(id)}`;
