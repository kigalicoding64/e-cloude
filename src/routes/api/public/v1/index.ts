import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { corsPreflight, CORS_HEADERS } from "@/lib/cors";

// GET /api/public/v1  -> machine-readable API discovery document.
export const Route = createFileRoute("/api/public/v1/")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        void request; const base = PUBLIC_BASE_URL;
        return new Response(
          JSON.stringify({
            name: "E-Cloud API",
            version: "1.0.0",
            base_url: `${base}/api/public/v1`,
            auth: {
              scheme: "api_key",
              header: "X-API-Key",
              alternative: "Authorization: Bearer eck_live_...",
              note: "Create keys in the dashboard under API Keys.",
            },
            endpoints: {
              health: "GET /health",
              me: "GET /me",
              list_files: "GET /files?folder=&limit=&offset=",
              get_file: "GET /files/{id}",
              update_file: "PATCH /files/{id}",
              delete_file: "DELETE /files/{id}",
              upload_direct: "POST /files/upload (multipart/form-data)",
              signed_upload_url: "POST /files/upload-url",
              commit_upload: "POST /files/commit",
              signed_download_url: "POST /files/{id}/signed-url",
              list_folders: "GET /folders",
              create_folder: "POST /folders",
              rename_folder: "PATCH /folders/{id}",
              delete_folder: "DELETE /folders/{id}",
              chunked_upload_init: "POST /uploads/init",
              chunked_upload_part: "PUT /uploads/{id}/chunks/{index}",
              chunked_upload_complete: "POST /uploads/{id}/complete",
              chunked_upload_status: "GET /uploads/{id}",
              resolve_share: "GET /shares/{token}",
              ai_chat: "POST /chat/{model_slug}",
            },
            errors: {
              format: '{ "error": "message" }',
              codes: [400, 401, 403, 404, 409, 413, 429, 500],
            },
            cors: "Enabled for all origins; OPTIONS preflight supported.",
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
        );
      },
    },
  },
});
