import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_download_link",
  title: "Get download link",
  description: "Create a temporary (5 minute) download link for one of the user's unlocked files.",
  inputSchema: { file_id: z.string().uuid() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ file_id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: f, error } = await sb
      .from("files")
      .select("id, name, storage_path, password_hash, pin_hash, is_trashed")
      .eq("id", file_id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!f || f.is_trashed) throw new ToolError("File not found");
    if (f.password_hash || f.pin_hash) throw new ToolError("This file is locked; unlock it in the app first.");
    const { data: s, error: se } = await sb.storage.from("user-files").createSignedUrl(f.storage_path, 300, { download: f.name });
    if (se || !s) throw new ToolError(se?.message ?? "Could not create link");
    return { content: [{ type: "text", text: s.signedUrl }], structuredContent: { url: s.signedUrl, expires_in: 300 } };
  },
});
