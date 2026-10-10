import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_files",
  title: "List files",
  description: "List the signed-in user's files, optionally filtered by folder or name search.",
  inputSchema: {
    folder_id: z.string().uuid().optional().describe("Only files in this folder."),
    search: z.string().max(200).optional().describe("Case-insensitive name filter."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ folder_id, search, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("files")
      .select("id, name, mime_type, size, folder_id, is_favorite, created_at, updated_at")
      .eq("is_trashed", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (folder_id) q = q.eq("folder_id", folder_id);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const files = (data ?? []).map((f) => ({
      id: f.id, name: f.name, mime_type: f.mime_type, size: f.size, folder_id: f.folder_id,
      is_favorite: f.is_favorite, created_at: f.created_at, updated_at: f.updated_at,
    }));
    return { content: [{ type: "text", text: JSON.stringify(files) }], structuredContent: { files } };
  },
});
