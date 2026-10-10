import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_folder",
  title: "Create folder",
  description: "Create a new folder for the signed-in user.",
  inputSchema: {
    name: z.string().trim().min(1).max(255),
    parent_id: z.string().uuid().optional().describe("Optional parent folder id."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, parent_id }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Not signed in");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("folders")
      .insert({ name, parent_id: parent_id ?? null, user_id: userId })
      .select("id, name, parent_id, created_at")
      .single();
    if (error) throw new ToolError(error.message);
    const folder = { id: data.id, name: data.name, parent_id: data.parent_id, created_at: data.created_at };
    return { content: [{ type: "text", text: `Created folder ${folder.name} (${folder.id})` }], structuredContent: { folder } };
  },
});
