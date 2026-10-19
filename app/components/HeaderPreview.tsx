/**
 * Live preview of the header: a sample store page (announcement bar, hero image, sample menu with
 * collection pictures) in a sandboxed frame running the real storefront script and stylesheet,
 * at a true desktop (1280px) or phone (390px) width, scaled down to fit.
 */
import { useEffect, useRef, useState } from "react";
import { toStorefrontHeader, type HeaderConfig } from "../lib/header";

const U = (id: string, w = 240) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${w}&fit=crop&q=60`;
const MENU = [
  { t: "Shop", u: "#", on: true, i: null, k: [] },
  {
    t: "Collections",
    u: "#",
    on: false,
    i: null,
    k: [
      { t: "New Arrivals", u: "#", i: U("1515886657613-9f3515b0c78f"), k: [] },
      { t: "Best Sellers", u: "#", i: U("1503342217505-b0a15ec3261c"), k: [] },
      { t: "Trending now", u: "#", i: null, k: ["T-Shirts", "Longsleeves", "Sweatshirts", "Trackpants"].map((t) => ({ t, u: "#" })) },
    ],
  },
  { t: "About", u: "#", on: false, i: null, k: [] },
  { t: "Journal", u: "#", on: false, i: null, k: [{ t: "Stories", u: "#", i: null, k: [] }, { t: "Guides", u: "#", i: null, k: [] }] },
];
const LOC = { cc: "EG", lc: "en", co: [["EG", "Egypt", "EGP"], ["AE", "United Arab Emirates", "AED"]], la: [] };
const HERO = "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&q=60";

function page(c: HeaderConfig, css: string, js: string, shop: string) {
  const logoUrl = c.logo.image?.url ?? null;
  const data = { c: toStorefrontHeader(c, logoUrl), m: MENU, loc: LOC };
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Inter",Helvetica,sans-serif}
.bar{background:#d7f25c;text-align:center;padding:7px;font-size:13px}
main{min-height:900px;background:url(${HERO}) center/cover}
h1{margin:0;padding:170px 6vw 0;font:italic 400 clamp(40px,7vw,72px)/1.05 Georgia,serif;color:#fff}
</style></head><body>
<div class="shopify-section"><div class="bar">Free shipping on orders over $100 →</div></div>
<div class="shopify-section section-header"><sticky-header class="header-wrapper"><header class="header">theme header</header></sticky-header></div>
<main><h1>The Essence of Style</h1></main>
<div id="ucs-hd" data-root="/" data-search="#" data-cart-url="#" data-count="2" data-acc="#" data-home="1" data-shop="${shop.replace(/"/g, "&quot;")}" hidden><script type="application/json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script><form id="ucs-hd-loc"></form></div>
<script>${js}</script>
<script>document.addEventListener("click",function(e){var a=e.target.closest("a");if(a)e.preventDefault()},true)</script>
</body></html>`;
}

export function HeaderPreview({ config, css, js, shop, phone }: { config: HeaderConfig; css: string; js: string; shop: string; phone: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [doc, setDoc] = useState(() => page(config, css, js, shop));
  // Rebuild the page a moment after the last change (typing stays smooth).
  useEffect(() => {
    const t = setTimeout(() => setDoc(page(config, css, js, shop)), 250);
    return () => clearTimeout(t);
  }, [config, css, js, shop]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const real = phone ? 390 : 1280;
  const height = phone ? 720 : 560;
  const scale = Math.min(1, width / real);
  return (
    <div ref={box} style={{ height: height * scale, overflow: "hidden" }}>
      <iframe
        title="Header preview"
        srcDoc={doc}
        sandbox="allow-scripts"
        style={{ width: real, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", display: "block", margin: phone ? `0 ${(width - real * scale) / 2}px` : 0 }}
      />
    </div>
  );
}
