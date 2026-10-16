import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/streamtape/upload — signed-in web upload of a video to Streamtape.
// Caller must send their session bearer token; verified below.
export const Route = createFileRoute("/api/public/streamtape/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
        try {
          const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
          if (!token) return j({ error: "Sign in required" }, 401);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: u } = await supabaseAdmin.auth.getUser(token);
          const userId = u.user?.id;
          if (!userId) return j({ error: "Sign in required" }, 401);
          const st = await import("@/lib/streamtape.server");
          if (!(await st.streamtapeEnabled())) return j({ error: "Video storage is not enabled" }, 409);
          const form = await request.formData();
          const file = form.get("file");
          const folderId = (form.get("folder_id") as string) || null;
          if (!(file instanceof File)) return j({ error: "file is required" }, 400);
          const name = file.name.trim().slice(0, 255);
          if (!name || /[\\/]/.test(name)) return j({ error: "Invalid file name" }, 400);
          if (!st.isVideo(file.type, name)) return j({ error: "Only videos go to Streamtape" }, 400);
          if (folderId) {
            const { data: fo } = await supabaseAdmin.from("folders").select("id").eq("id", folderId).eq("user_id", userId).maybeSingle();
            if (!fo) return j({ error: "Folder not found" }, 404);
          }
          const up = await st.streamtapeUpload(file);
          const { data: row, error } = await supabaseAdmin.from("files").insert({
            user_id: userId,
            folder_id: folderId,
            name,
            size: file.size,
            mime_type: file.type || "video/mp4",
            storage_path: `streamtape:${up.id}`,
            storage_provider: "streamtape",
            external_id: up.id,
          }).select("id").single();
          if (error) return j({ error: error.message }, 500);
          const { data: prof } = await supabaseAdmin.from("profiles").select("storage_used").eq("id", userId).maybeSingle();
          await supabaseAdmin.from("profiles").update({ storage_used: Number(prof?.storage_used ?? 0) + file.size }).eq("id", userId);
          return j({ id: row.id, provider: "streamtape" }, 201);
        } catch (e) {
          console.error("streamtape upload failed", e);
          return j({ error: (e as Error).message }, 502);
        }
      },
    },
  },
});
