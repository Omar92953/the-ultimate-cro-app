/**
 * The page a merchant lands on from "See live demo" in the app: a slim top bar (the feature,
 * Desktop/Phone, Install CRO Toolbox) and every design of the feature stacked (#design-1,
 * #design-2…), each a demo store page in an iframe. No navigation to other demos or the website.
 */
import { BASE } from "./base.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const MARK = `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="currentColor"><rect x="10" y="60" width="20" height="30" rx="5"/><rect x="40" y="42" width="20" height="48" rx="5"/><path d="M70 34 H64 L80 10 L96 34 H90 V85 Q90 90 85 90 H75 Q70 90 70 85 Z"/></g></svg>`;

const CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{--ink:#0b0b0f;--mist:#f3f3f0;--line:#e4e4de;--muted:#5a5c66;--accent:#3ee08f}
html{scroll-padding-top:76px}
body{margin:0;background:var(--mist);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.bar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:12px;height:60px;padding:0 16px;background:var(--ink);color:#fff}
.bar__name{display:flex;align-items:center;gap:10px;min-width:0;font-weight:700}
.bar__name svg{width:22px;height:22px;flex:none}
.bar__name span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar__name small{font-weight:500;color:#a6a8b3;margin-left:6px}
.seg{display:inline-flex;margin-left:auto;padding:3px;border-radius:999px;background:#24252c}
.seg button{border:0;background:none;color:#c9cad1;font:inherit;font-size:13px;font-weight:600;padding:7px 14px;border-radius:999px;cursor:pointer}
.seg button[aria-pressed="true"]{background:#fff;color:var(--ink)}
.install{display:inline-flex;align-items:center;min-height:38px;padding:0 16px;border-radius:999px;background:var(--accent);color:var(--ink);font-weight:700;font-size:14px;text-decoration:none;white-space:nowrap}
.install:hover{background:#5ef0a5}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media (max-width:640px){.bar__name small{display:none}.install{margin-left:auto;padding:0 12px;font-size:13px}.install span{display:none}.seg{display:none}}
main{max-width:1240px;margin:0 auto;padding:20px 16px 48px}
.intro{color:var(--muted);margin:4px 0 18px;font-size:14px}
.design{margin:0 0 28px;scroll-margin-top:76px}
.design h2{display:flex;align-items:baseline;gap:10px;font-size:15px;margin:0 0 10px}
.design h2 b{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.stage{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgb(11 11 15/.04),0 10px 30px rgb(11 11 15/.06);margin:0 auto;transition:max-width .25s ease}
.stage iframe{display:block;width:100%;border:0;height:620px;background:#fff}
body.phone .stage{max-width:390px;border:10px solid #16161a;border-radius:36px}
.tip{font-size:12px;color:var(--muted);margin:8px 0 0;text-align:center}
`;

export function viewerPage({ title, about, installUrl, designs, tip = "" }) {
  const sections = designs
    .map(
      (d) => `<section class="design" id="design-${d.n}" aria-label="Design ${d.n}: ${esc(d.title)}">
  <h2><b>Design ${d.n}</b>${esc(d.title)}</h2>
  <div class="stage"><iframe src="${d.src}" title="${esc(title)}, design ${d.n}: ${esc(d.title)}" data-id="${d.id}"${d.scroll ? ` data-fixed="${d.scroll}" style="height:${d.scroll}px"` : ""}${d.minHeight ? ` data-min="${d.minHeight}"` : ""}${d.n > 2 ? ' loading="lazy"' : ""}></iframe></div>
  ${d.tip ? `<p class="tip">${esc(d.tip)}</p>` : ""}
</section>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}: live demo | CRO Toolbox</title><link rel="icon" href="${BASE}/favicon.svg" type="image/svg+xml"><style>${CSS}</style></head>
<body>
<header class="bar">
  <div class="bar__name">${MARK}<span>${esc(title)}<small>Live demo</small></span></div>
  <div class="seg" role="group" aria-label="Preview size"><button type="button" data-view="desktop" aria-pressed="true">Desktop</button><button type="button" data-view="phone" aria-pressed="false">Phone</button></div>
  <a class="install" href="${esc(installUrl)}" target="_blank" rel="noopener">Install <span>&nbsp;CRO Toolbox</span></a>
</header>
<main>
  <p class="intro">${esc(about)} ${designs.length > 1 ? `${designs.length} designs below, each one ready to pick in the app.` : ""} ${tip ? esc(tip) : "Click around: it works like on a real store."}</p>
  ${sections}
</main>
<script>
(function () {
  var frames = Array.prototype.slice.call(document.querySelectorAll("iframe"));
  var settled = false;
  function toHash() { if (!settled && location.hash) { var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); } }
  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.type !== "demo-height") return;
    frames.forEach(function (f) {
      if (f.dataset.id !== d.id || f.dataset.fixed) return;
      f.style.height = Math.max(Number(f.dataset.min || 0), Math.min(d.h, 4000)) + "px";
    });
    toHash();
  });
  setTimeout(function () { settled = true; }, 4000);
  document.querySelectorAll(".seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      var phone = b.dataset.view === "phone";
      document.body.classList.toggle("phone", phone);
      document.querySelectorAll(".seg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    });
  });
})();
</script>
</body></html>`;
}
