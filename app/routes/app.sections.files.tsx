/**
 * Resource route (JSON only) for the section forms' file picker:
 *   GET  ?accept=image|media           newest images (and videos) in Content → Files
 *   POST intent=start  filename, mimeType, fileSize   → staged upload target
 *   POST intent=finish resourceUrl, video, alt        → the new file
 * App Bridge adds the session token to these same-origin fetches.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { finishUpload, listFiles, startUpload } from "../lib/sections.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const accept = new URL(request.url).searchParams.get("accept") === "image" ? "image" : "media";
  try {
    return Response.json({ ok: true, files: await listFiles(admin, accept) });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e), files: [] });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "start") {
      const target = await startUpload(admin, {
        filename: String(form.get("filename") || "upload"),
        mimeType: String(form.get("mimeType") || ""),
        fileSize: Number(form.get("fileSize")) || 0,
      });
      return Response.json({ ok: true, target });
    }
    if (form.get("intent") === "finish") {
      const file = await finishUpload(admin, {
        resourceUrl: String(form.get("resourceUrl")),
        video: form.get("video") === "true",
        alt: String(form.get("alt") || ""),
      });
      return Response.json({ ok: true, file });
    }
    return Response.json({ ok: false, error: "Unknown request." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) });
  }
};
