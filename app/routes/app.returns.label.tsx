/**
 * Resource route (JSON only) for uploading a return label on the Returns page:
 *   POST intent=start  filename, mimeType, fileSize → staged upload target
 *   POST intent=finish resourceUrl, image          → { id }
 *   POST intent=status id                          → { url } (null while Shopify processes the file)
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { finishLabelUpload, labelFileUrl, startLabelUpload } from "../lib/shopify-returns.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const intent = form.get("intent");
    if (intent === "start") return Response.json({ ok: true, target: await startLabelUpload(admin, { filename: String(form.get("filename") || "label"), mimeType: String(form.get("mimeType") || ""), fileSize: Number(form.get("fileSize")) || 0 }) });
    if (intent === "finish") return Response.json({ ok: true, id: await finishLabelUpload(admin, { resourceUrl: String(form.get("resourceUrl")), image: form.get("image") === "true", alt: "Return label" }) });
    if (intent === "status") {
      const id = String(form.get("id"));
      if (!/^gid:\/\/shopify\/(GenericFile|MediaImage)\/\d+$/.test(id)) return Response.json({ ok: false, error: "Unknown file." }, { status: 400 });
      return Response.json({ ok: true, url: await labelFileUrl(admin, id) });
    }
    return Response.json({ ok: false, error: "Unknown request." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) });
  }
};
