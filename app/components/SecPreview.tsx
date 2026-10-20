/**
 * Live preview of a CRO section: runs the real storefront scripts (ucs-sec.js + ucs-sec-<kind>.js, read
 * on the server) on the design, with sample products and pictures where the merchant hasn't picked any,
 * so the preview draws exactly what the store will. Phone layouts follow the preview's width
 * (container queries), so a narrow PreviewFrame shows the phone layout.
 */
import { useEffect, useRef } from "react";
import { SAMPLE_IMAGES, SAMPLE_PRODUCTS, toStorefrontSec, type SecConfig, type SecContent } from "../lib/cro-sections";

type Runtime = { css: string; js: string };
type Win = Window & { UCSsec?: { mount: (el: HTMLElement, c: unknown, ctx: unknown) => void }; __usecLoaded?: Set<string> };

const SAMPLE_DESC = "<p>Made in small batches from natural ingredients. Gentle enough for every day.</p><ul><li>50 ml glass bottle</li><li>Vegan and cruelty free</li></ul>";
const sampleImage = (u: string) => ({ u, w: 1200, h: 800 });

/** Loads each storefront script once into the admin page (they only define window.UCSsec renderers). */
function load(js: string) {
  const w = window as Win;
  w.__usecLoaded ??= new Set();
  if (w.__usecLoaded.has(js)) return;
  w.__usecLoaded.add(js);
  new Function(js)();
}

/** The storefront JSON with sample pictures and products filled in for the preview. */
export function previewData(c: SecConfig) {
  const images = new Map<string, { url: string; width: number; height: number }>();
  const content = c.content as Record<string, unknown>;
  const refs = [content.image, content.before, content.after, ...((content.items as { image: unknown }[] | undefined) ?? []).map((i) => i.image)];
  for (const m of refs as ({ id: string; url: string | null } | null)[]) if (m?.url) images.set(m.id, { url: m.url, width: 1200, height: 800 });
  const sf = toStorefrontSec(c, images) as ReturnType<typeof toStorefrontSec> & { d: Record<string, unknown> };
  const d = { ...sf.d };
  const products: Record<string, unknown> = {};
  const product = (h: string, title: string, price: number, image: string | null, n = 1) => ({ handle: h, title, available: true, featured_image: image, variants: Array.from({ length: n }, (_, i) => ({ id: 1000 + i, price, compare_at_price: null, available: true })) });
  for (const p of SAMPLE_PRODUCTS) products[p.handle] = product(p.handle, p.title, p.price, p.image);
  if (c.kind === "before_after") {
    d.a ??= sampleImage(SAMPLE_IMAGES.before);
    d.b ??= sampleImage(SAMPLE_IMAGES.after);
  }
  if (c.kind === "shoppable") {
    d.im ??= { u: SAMPLE_IMAGES.look, w: 1400, h: 900 };
    if (!(d.spots as unknown[]).length) {
      d.spots = [
        { x: 30, y: 40, h: "linen-shirt", t: "Linen shirt", im: SAMPLE_PRODUCTS[1].image, pr: 5400, v: "1000", n: 1 },
        { x: 62, y: 66, h: "canvas-tote", t: "Canvas tote", im: SAMPLE_PRODUCTS[4].image, pr: 3200, v: "1000", n: 1 },
      ];
    }
    for (const s of d.spots as { h: string; t: string; pr: number; im: string | null; n: number }[]) products[s.h] ??= product(s.h, s.t, s.pr, s.im, s.n);
  }
  if (c.kind === "email_popup") {
    const x = c.content as SecContent["email_popup"];
    if (!d.im && !x.image && (c.layout as { style: string }).style !== "center") d.im = sampleImage(SAMPLE_IMAGES.popup);
  }
  return { c: { ...sf, d }, ctx: { preview: true, root: "/", fmt: "${{amount}}", p: "glow-serum", t: { desc: SAMPLE_DESC }, products, recent: ["glow-serum", ...SAMPLE_PRODUCTS.slice(1).map((p) => p.handle)] } };
}

export function SecPreview({ config, runtime, pad = true }: { config: SecConfig; runtime: Runtime; pad?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    load(runtime.js);
    const w = window as Win;
    const { c, ctx } = previewData(config);
    // A fresh element each time, so listeners from the last draw don't pile up.
    const inner = document.createElement("div");
    el.replaceChildren(inner);
    w.UCSsec?.mount(inner, c, ctx);
  }, [config, runtime.js]);
  return (
    <div style={{ padding: pad ? "8px 0" : 0 }}>
      <style dangerouslySetInnerHTML={{ __html: runtime.css }} />
      <div ref={box} />
    </div>
  );
}
