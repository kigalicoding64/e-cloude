import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_folders",
  title: "List folders",
  description: "List the signed-in user's folders, optionally inside a parent folder.",
  inputSchema: { parent_id: z.string().uuid().optional().describe("Parent folder id; omit for all folders.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ parent_id }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb.from("folders").select("id, name, parent_id, created_at").order("name");
    if (parent_id) q = q.eq("parent_id", parent_id);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const folders = (data ?? []).map((f) => ({ id: f.id, name: f.name, parent_id: f.parent_id, created_at: f.created_at }));
    return { content: [{ type: "text", text: JSON.stringify(folders) }], structuredContent: { folders } };
  },
});
