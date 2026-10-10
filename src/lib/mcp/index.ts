import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFiles from "./tools/list-files";
import listFolders from "./tools/list-folders";
import createFolder from "./tools/create-folder";
import getDownloadLink from "./tools/get-download-link";
import trashFile from "./tools/trash-file";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "cloud-canvas",
  title: "Cloud Canvas",
  version: "0.1.0",
  instructions:
    "Tools for E-Cloud storage. Browse the signed-in user's files and folders, create folders, get temporary download links and move files to trash.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listFiles, listFolders, createFolder, getDownloadLink, trashFile],
});
