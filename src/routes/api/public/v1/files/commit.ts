import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight } from "@/lib/cors";

// POST /api/public/v1/files/commit
// Body: { storage_path, name?, folder_id?, mime_type? }
// Registers a file uploaded directly via a signed upload URL. Idempotent when
// an Idempotency-Key header is supplied (and inherently safe to retry).
export const Route = createFileRoute("/api/public/v1/files/commit")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const { authorize, apiError, json, beginIdempotency, finishIdempotency } =
          await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "upload");
        if (error) return error;

        const body = (await request.json().catch(() => null)) as {
          storage_path?: unknown; name?: unknown; folder_id?: unknown; mime_type?: unknown;
        } | null;
        const storagePath = String(body?.storage_path ?? "");
        if (!storagePath.startsWith(`${caller.userId}/`)) {
          return apiError("validation_failed", "Invalid 'storage_path'");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Already committed? Return the existing row (natural idempotency).
        const { data: existing } = await supabaseAdmin
          .from("files")
          .select("id,name,size,mime_type,folder_id,created_at")
          .eq("user_id", caller.userId)
          .eq("storage_path", storagePath)
          .maybeSingle();
        if (existing) return json(existing, 200, { "Idempotent-Replayed": "true" });

        const { replay, handle } = await beginIdempotency(
          request, caller, "POST /files/commit", storagePath,
        );
        if (replay) return replay;

        const dir = storagePath.slice(0, storagePath.lastIndexOf("/")) || caller.userId;
        const base = storagePath.slice(storagePath.lastIndexOf("/") + 1);
        const { data: listed } = await supabaseAdmin.storage.from("user-files").list(dir, { search: base });
        const obj = listed?.find((o) => o.name === base);
        if (!obj) {
          await finishIdempotency(handle, 409, null);
          return apiError("upload_incomplete", "Upload not found in storage — PUT the bytes before committing");
        }
        const size = Number((obj.metadata as { size?: number } | null)?.size ?? 0);
        const mime =
          (body?.mime_type ? String(body.mime_type) : null) ??
          ((obj.metadata as { mimetype?: string } | null)?.mimetype ?? "application/octet-stream");
        const name = String(body?.name ?? base.replace(/^[0-9a-f]{32}-/, "")).slice(0, 200);

        const { data: row, error: dbErr } = await supabaseAdmin.from("files").insert({
          user_id: caller.userId,
          folder_id: body?.folder_id ? String(body.folder_id) : null,
          name,
          size,
          mime_type: mime,
          storage_path: storagePath,
        }).select("id,name,size,mime_type,folder_id,created_at").single();
        if (dbErr) {
          await finishIdempotency(handle, 500, null);
          return apiError("internal_error", dbErr.message);
        }

        const { data: prof } = await supabaseAdmin
          .from("profiles").select("storage_used").eq("id", caller.userId).maybeSingle();
        await supabaseAdmin.from("profiles")
          .update({ storage_used: Number(prof?.storage_used ?? 0) + size })
          .eq("id", caller.userId);

        await finishIdempotency(handle, 201, row);
        return json(row, 201);
      },
    },
  },
});
