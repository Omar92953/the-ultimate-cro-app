/** Pick an image (or video) from Content → Files, or upload a new one right here. Uses /app/sections/files. */
import { useState } from "react";
import type { FileOption } from "../lib/sections.server";
import type { MediaRef } from "../lib/sections";
import { Button, DropZone } from "./fields";

export function MediaPicker(props: {
  label: string;
  details?: string;
  accept: "image" | "media";
  value: MediaRef | null;
  onValue: (v: MediaRef | null) => void;
  /** Alt text given to a newly uploaded file. */
  alt: string;
  error?: string;
}) {
  const accept = props.accept;
  const [files, setFiles] = useState<FileOption[] | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const loadFiles = async () => {
    setBrowsing((b) => !b);
    if (files) return;
    const res = await fetch(`/app/sections/files?accept=${accept}`);
    const json = await res.json();
    setFiles(json.files ?? []);
    if (!json.ok) setError(json.error);
  };

  const post = async (data: Record<string, string>) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(data)) body.set(k, v);
    const json = await (await fetch("/app/sections/files", { method: "POST", body })).json();
    if (!json.ok) throw new Error(json.error || "Upload failed");
    return json;
  };

  const upload = async (file: File) => {
    setError("");
    setBusy(`Uploading ${file.name}…`);
    try {
      const { target } = await post({ intent: "start", filename: file.name, mimeType: file.type, fileSize: String(file.size) });
      const body = new FormData();
      for (const p of target.parameters) body.append(p.name, p.value);
      body.append("file", file);
      const sent = await fetch(target.url, { method: "POST", body });
      if (!sent.ok) throw new Error(`The upload was refused (${sent.status}). Try a smaller file.`);
      setBusy("Adding it to your files…");
      const { file: created } = await post({ intent: "finish", resourceUrl: target.resourceUrl, video: String(target.video), alt: props.alt });
      setLocalPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
      props.onValue({ id: created.id, url: created.url, kind: created.kind, title: created.title || file.name });
      setFiles(null);
      setBrowsing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const v = props.value;
  const thumb = v?.url ?? localPreview ?? undefined;
  return (
    <s-stack gap="small-200">
      <s-text type="strong">{props.label}</s-text>
      {v ? (
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-thumbnail src={thumb} alt={v.title} size="large" />
          <s-stack gap="small-100">
            <s-text>{v.kind === "video" ? "Video" : "Image"}: {v.title}</s-text>
            {!v.url && !localPreview ? <s-text color="subdued">{"Shopify is still processing it — that's fine, you can save now."}</s-text> : null}
            <s-stack direction="inline" gap="small-200">
              <Button variant="tertiary" onClick={loadFiles}>
                Change
              </Button>
              <Button variant="tertiary" tone="critical" onClick={() => { props.onValue(null); setLocalPreview(null); }}>
                Remove
              </Button>
            </s-stack>
          </s-stack>
        </s-stack>
      ) : null}
      {!v || browsing ? (
        <>
          <DropZone
            label={accept === "image" ? "Drop an image here, or click to upload" : "Drop a photo or video here, or click to upload"}
            accept={accept === "image" ? "image/*" : "image/*,video/*"}
            disabled={!!busy}
            onFiles={(fs) => upload(fs[0])}
            error={props.error && !v ? props.error : undefined}
          />
          <s-box>
            <Button variant="tertiary" icon="image" onClick={loadFiles}>
              {browsing ? "Hide my files" : "Choose from Content → Files"}
            </Button>
          </s-box>
        </>
      ) : null}
      {busy ? (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-spinner accessibilityLabel={busy} size="base" />
          <s-text>{busy}</s-text>
        </s-stack>
      ) : null}
      {error ? <s-banner tone="critical">{error}</s-banner> : null}
      {browsing ? (
        files === null ? (
          <s-spinner accessibilityLabel="Loading files" />
        ) : files.length ? (
          <s-grid gridTemplateColumns="repeat(auto-fill, minmax(96px, 1fr))" gap="small-200">
            {files.map((f) => (
              <s-clickable
                key={f.id}
                onClick={() => { props.onValue(f); setLocalPreview(null); setBrowsing(false); }}
                borderWidth="base"
                borderRadius="base"
                padding="small-200"
                accessibilityLabel={`Use ${f.title}`}
              >
                <s-stack gap="small-100" alignItems="center">
                  <s-thumbnail src={f.url ?? undefined} alt={f.title} size="base" />
                  <s-text color="subdued">{f.kind === "video" ? "Video" : f.title.slice(0, 14)}</s-text>
                </s-stack>
              </s-clickable>
            ))}
          </s-grid>
        ) : (
          <s-text color="subdued">No files yet — upload one above.</s-text>
        )
      ) : null}
      {props.details ? <s-text color="subdued">{props.details}</s-text> : null}
    </s-stack>
  );
}

