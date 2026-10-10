import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "trash_file",
  title: "Move file to trash",
  description: "Move one of the user's files to the trash (recoverable from the Trash page).",
  inputSchema: { file_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ file_id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("files")
      .update({ is_trashed: true, trashed_at: new Date().toISOString() })
      .eq("id", file_id)
      .select("id, name")
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("File not found");
    return { content: [{ type: "text", text: `Moved ${data.name} to trash` }], structuredContent: { id: data.id, name: data.name } };
  },
});
