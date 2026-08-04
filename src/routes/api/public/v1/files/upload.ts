import { createFileRoute } from "@tanstack/react-router";
import { randomToken } from "@/lib/hash";
import { corsPreflight } from "@/lib/cors";

export const Route = createFileRoute("/api/public/v1/files/upload")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const { authorize, apiError, beginIdempotency, finishIdempotency, json } =
          await import("@/lib/api-auth.server");
        const { caller, error } = await authorize(request, "upload");
        if (error) return error;

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return apiError("bad_request", "Expected multipart/form-data");
        }
        const file = form.get("file");
        if (!(file instanceof File)) return apiError("validation_failed", "Missing 'file' field");
        if (file.size > 500 * 1024 * 1024) {
          return apiError("payload_too_large", "File too large (max 500MB) — use the chunked upload API");
        }
        const folder = form.get("folder");
        const folderId = typeof folder === "string" && folder ? folder : null;

        const fingerprint = `${file.name}:${file.size}:${folderId ?? ""}`;
        const { replay, handle } = await beginIdempotency(
          request, caller, "POST /files/upload", fingerprint,
        );
        if (replay) return replay;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Quota check
        const { data: prof } = await supabaseAdmin.from("profiles").select("storage_used, storage_quota").eq("id", caller.userId).maybeSingle();
        if (prof && Number(prof.storage_used) + file.size > Number(prof.storage_quota)) {
          await finishIdempotency(handle, 413, null);
          return apiError("quota_exceeded", "Storage quota exceeded");
        }

        const safeName = file.name.slice(0, 200);
        const storagePath = `${caller.userId}/${randomToken(16)}-${safeName}`;
        const buf = new Uint8Array(await file.arrayBuffer());
        const { error: upErr } = await supabaseAdmin.storage.from("user-files").upload(storagePath, buf, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (upErr) {
          await finishIdempotency(handle, 500, null);
          return apiError("storage_error", `Upload failed: ${upErr.message}`);
        }

        const { data: row, error: dbErr } = await supabaseAdmin.from("files").insert({
          user_id: caller.userId,
          folder_id: folderId,
          name: safeName,
          size: file.size,
          mime_type: file.type || "application/octet-stream",
          storage_path: storagePath,
        }).select("id,name,size,mime_type,folder_id,created_at").single();
        if (dbErr) {
          await supabaseAdmin.storage.from("user-files").remove([storagePath]);
          await finishIdempotency(handle, 500, null);
          return apiError("internal_error", dbErr.message);
        }

        const newUsed = Number(prof?.storage_used ?? 0) + file.size;
        await supabaseAdmin.from("profiles").update({ storage_used: newUsed }).eq("id", caller.userId);

        await finishIdempotency(handle, 201, row);
        return json(row, 201);
      },
    },
  },
});
