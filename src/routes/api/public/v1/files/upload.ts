import { createFileRoute } from "@tanstack/react-router";
import { randomToken } from "@/lib/hash";

export const Route = createFileRoute("/api/public/v1/files/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateApiKey, json, jsonError } = await import("@/lib/api-auth.server");
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonError("Invalid or missing API key", 401);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonError("Expected multipart/form-data", 400);
        }
        const file = form.get("file");
        if (!(file instanceof File)) return jsonError("Missing 'file' field", 400);
        if (file.size > 500 * 1024 * 1024) return jsonError("File too large (max 500MB)", 413);
        const folder = form.get("folder");
        const folderId = typeof folder === "string" && folder ? folder : null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Quota check
        const { data: prof } = await supabaseAdmin.from("profiles").select("storage_used, storage_quota").eq("id", auth.userId).maybeSingle();
        if (prof && Number(prof.storage_used) + file.size > Number(prof.storage_quota)) {
          return jsonError("Storage quota exceeded", 413);
        }

        const safeName = file.name.slice(0, 200);
        const storagePath = `${auth.userId}/${randomToken(16)}-${safeName}`;
        const buf = new Uint8Array(await file.arrayBuffer());
        const { error: upErr } = await supabaseAdmin.storage.from("user-files").upload(storagePath, buf, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (upErr) return jsonError(`Upload failed: ${upErr.message}`, 500);

        const { data: row, error: dbErr } = await supabaseAdmin.from("files").insert({
          user_id: auth.userId,
          folder_id: folderId,
          name: safeName,
          size: file.size,
          mime_type: file.type || "application/octet-stream",
          storage_path: storagePath,
        }).select("id,name,size,mime_type,folder_id,created_at").single();
        if (dbErr) {
          await supabaseAdmin.storage.from("user-files").remove([storagePath]);
          return jsonError(dbErr.message, 500);
        }

        // Update quota
        const newUsed = Number(prof?.storage_used ?? 0) + file.size;
        await supabaseAdmin.from("profiles").update({ storage_used: newUsed }).eq("id", auth.userId);

        return json(row, 201);
      },
    },
  },
});
