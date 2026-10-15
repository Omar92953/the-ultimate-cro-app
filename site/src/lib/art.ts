/**
 * Product pictures for the demo store, drawn as SVG: no stock photos needed, sharp at any size, a
 * few hundred bytes each. Used by the site's components (ProductArt.astro) and written as files for
 * the live demos (demos/build.mjs, demo.crotoolbox.com), so both show the same products.
 *
 * `tint` recolours the product itself (a candle in another wax, a tee in another colour), so one
 * drawing can stand for several products.
 */
export type ArtKind = "serum" | "cream" | "candle" | "mug" | "tote" | "soap" | "bottle" | "tee" | "socks" | "gift" | "plant";
export const ART_KINDS: ArtKind[] = ["serum", "cream", "candle", "mug", "tote", "soap", "bottle", "tee", "socks", "gift", "plant"];

const BG: Record<ArtKind, [string, string]> = {
  serum: ["#f6e7da", "#efd6c2"],
  cream: ["#e6eef2", "#d3e2ea"],
  candle: ["#efe7dc", "#e2d5c3"],
  mug: ["#e5ece4", "#d2dfd0"],
  tote: ["#ece6f3", "#dcd3ea"],
  soap: ["#f4ede0", "#ebdfc8"],
  bottle: ["#e3ecf0", "#cfdfe6"],
  tee: ["#f1e4e4", "#e6d0d0"],
  socks: ["#e9eef6", "#d6e0ef"],
  gift: ["#f6e4e8", "#edd0d7"],
  plant: ["#e6efe2", "#d4e3cd"],
};
/** Each kind's main product colour (what `tint` replaces). */
const BODY: Record<ArtKind, string> = {
  serum: "#c98b5e",
  cream: "#f7fafb",
  candle: "#3f4a3c",
  mug: "#e9e1d6",
  tote: "#efe8dc",
  soap: "#e7d3ad",
  bottle: "#5d8aa8",
  tee: "#2e2a2a",
  socks: "#3d5a80",
  gift: "#c0475d",
  plant: "#d9c3a5",
};

export type ArtOptions = {
  /** Unique within the page (gradient ids). */
  id: string;
  tint?: string;
  fit?: "slice" | "meet";
  /** Accessible name; empty = decorative. */
  alt?: string;
  cls?: string;
  /** Write width/height attributes (for standalone .svg files). */
  size?: number;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function artSvg(kind: ArtKind, o: ArtOptions): string {
  const [bg1, bg2] = BG[kind];
  const body = o.tint ?? BODY[kind];
  const sh = `url(#${o.id}sh)`;
  const fit = o.fit ?? "slice";
  const a11y = o.alt ? `role="img" aria-label="${esc(o.alt)}"` : `aria-hidden="true"`;
  const attrs = [
    `xmlns="http://www.w3.org/2000/svg"`,
    `viewBox="0 0 200 200"`,
    o.size ? `width="${o.size}" height="${o.size}"` : "",
    o.cls ? `class="${esc(o.cls)}"` : "",
    a11y,
    `preserveAspectRatio="xMidYMid ${fit}"`,
    fit === "meet" ? `style="background:linear-gradient(${bg1},${bg2})"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const shapes: Record<ArtKind, string> = {
    serum: `<rect x="82" y="40" width="36" height="22" rx="6" fill="#2b2420"/><rect x="88" y="26" width="24" height="18" rx="9" fill="#3a302a"/><rect x="70" y="60" width="60" height="108" rx="14" fill="${body}"/><rect x="70" y="60" width="60" height="108" rx="14" fill="${sh}"/><rect x="80" y="98" width="40" height="40" rx="4" fill="#f8efe6"/><rect x="86" y="108" width="28" height="4" rx="2" fill="#2b2420"/><rect x="90" y="117" width="20" height="3" rx="1.5" fill="#9a7a62"/><rect x="92" y="125" width="16" height="3" rx="1.5" fill="#9a7a62"/>`,
    cream: `<rect x="56" y="78" width="88" height="26" rx="8" fill="#1f2a33"/><rect x="52" y="100" width="96" height="68" rx="16" fill="${body}"/><rect x="52" y="100" width="96" height="68" rx="16" fill="${sh}"/><rect x="74" y="122" width="52" height="5" rx="2.5" fill="#1f2a33"/><rect x="84" y="133" width="32" height="3" rx="1.5" fill="#8aa0ad"/>`,
    candle: `<path d="M100 44c7 9 8 16 0 24-8-8-7-15 0-24z" fill="#f5a524"/><path d="M100 52c3 5 3 9 0 13-3-4-3-8 0-13z" fill="#fff3c4"/><rect x="98.5" y="66" width="3" height="10" fill="#3a3a3a"/><rect x="62" y="76" width="76" height="92" rx="12" fill="${body}"/><rect x="62" y="76" width="76" height="92" rx="12" fill="${sh}"/><rect x="62" y="76" width="76" height="12" rx="6" fill="#efe4d0"/><rect x="76" y="114" width="48" height="30" rx="4" fill="#efe4d0"/><rect x="84" y="124" width="32" height="4" rx="2" fill="${body}"/><rect x="90" y="132" width="20" height="3" rx="1.5" fill="#8b8a73"/>`,
    mug: `<path d="M134 92h8a18 18 0 0 1 0 36h-8" fill="none" stroke="#d9cfc2" stroke-width="10"/><rect x="58" y="78" width="80" height="90" rx="14" fill="${body}"/><rect x="58" y="78" width="80" height="90" rx="14" fill="${sh}"/><rect x="58" y="78" width="80" height="20" rx="10" fill="#c46a4a"/><circle cx="98" cy="128" r="14" fill="none" stroke="#c46a4a" stroke-width="4"/>`,
    tote: `<path d="M80 80V64a20 20 0 0 1 40 0v16" fill="none" stroke="#3b3550" stroke-width="7" stroke-linecap="round"/><path d="M56 80h88l-6 88H62z" fill="${body}"/><path d="M56 80h88l-6 88H62z" fill="${sh}"/><rect x="80" y="110" width="40" height="30" rx="4" fill="#6b5ca5"/><path d="M90 125l7 7 13-14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    soap: `<rect x="46" y="112" width="108" height="56" rx="18" fill="${body}"/><rect x="46" y="112" width="108" height="56" rx="18" fill="${sh}"/><rect x="56" y="78" width="88" height="44" rx="16" fill="#f6ead2"/><rect x="56" y="78" width="88" height="44" rx="16" fill="${sh}"/><rect x="82" y="96" width="36" height="6" rx="3" fill="#a88a5a"/>`,
    bottle: `<rect x="86" y="30" width="28" height="12" rx="3" fill="#1d2b36"/><path d="M84 42h32l-2 14H86z" fill="#1d2b36"/><rect x="64" y="56" width="72" height="112" rx="20" fill="${body}"/><rect x="64" y="56" width="72" height="112" rx="20" fill="${sh}"/><rect x="76" y="92" width="48" height="50" rx="6" fill="#f2f7fa"/><rect x="84" y="104" width="32" height="5" rx="2.5" fill="#1d2b36"/><rect x="88" y="115" width="24" height="3" rx="1.5" fill="#7f9db0"/><rect x="90" y="123" width="20" height="3" rx="1.5" fill="#7f9db0"/>`,
    tee: `<path d="M74 48l-34 18 12 26 14-6v82h68V86l14 6 12-26-34-18c-4 10-14 16-26 16s-22-6-26-16z" fill="${body}"/><path d="M74 48l-34 18 12 26 14-6v82h68V86l14 6 12-26-34-18c-4 10-14 16-26 16s-22-6-26-16z" fill="${sh}"/><circle cx="100" cy="112" r="16" fill="none" stroke="#e8c9c9" stroke-width="4"/>`,
    socks: `<path d="M70 40h30v70l26 30a16 16 0 0 1-22 22l-34-36z" fill="${body}"/><path d="M70 40h30v70l26 30a16 16 0 0 1-22 22l-34-36z" fill="${sh}"/><rect x="70" y="40" width="30" height="12" fill="#f2e9dc"/><path d="M104 54h28v62l20 26a15 15 0 0 1-22 20l-26-34z" fill="${body}" opacity=".75"/><rect x="104" y="54" width="28" height="11" fill="#f2e9dc" opacity=".9"/>`,
    gift: `<rect x="52" y="86" width="96" height="82" rx="8" fill="${body}"/><rect x="52" y="86" width="96" height="82" rx="8" fill="${sh}"/><rect x="46" y="72" width="108" height="22" rx="6" fill="${body}"/><rect x="92" y="72" width="16" height="96" fill="#f4d58d"/><path d="M100 72c-16-22-36-10-24 0zM100 72c16-22 36-10 24 0z" fill="none" stroke="#f4d58d" stroke-width="6" stroke-linejoin="round"/>`,
    plant: `<path d="M100 104c-4-26-24-40-40-38 2 22 20 36 40 38z" fill="#4f7a4a"/><path d="M100 104c4-30 26-46 44-42-4 24-22 40-44 42z" fill="#5f8f58"/><path d="M100 104c0-24 6-44 0-60-10 18-8 38 0 60z" fill="#3f6a3b"/><path d="M66 104h68l-8 64H74z" fill="${body}"/><path d="M66 104h68l-8 64H74z" fill="${sh}"/><rect x="62" y="100" width="76" height="12" rx="4" fill="${body}"/>`,
  };
  return `<svg ${attrs}><defs><linearGradient id="${o.id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient><linearGradient id="${o.id}sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient></defs><rect width="200" height="200" fill="url(#${o.id}bg)"/><ellipse cx="100" cy="170" rx="52" ry="7" fill="#000" opacity=".08"/>${shapes[kind]}</svg>`;
}
