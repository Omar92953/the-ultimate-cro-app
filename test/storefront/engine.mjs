/**
 * Shared by the storefront harnesses (render.mjs, sections.mjs) and the website's live demos
 * (site/scripts/build-demos.mjs): a LiquidJS engine set up like Shopify for the theme app
 * extension's real blocks, plus helpers for mock shop data.
 *
 * The caller passes the Liquid class, so each caller uses its own copy of liquidjs (the website
 * installs its own; it can't rely on the app's node_modules).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
export const EXT = path.resolve(here, "../../extensions/cro-storefront");

let hooked = false;
/** App modules import each other without ".ts" (bundler style); let Node find them. */
export function resolveTsImports() {
  if (hooked) return;
  hooked = true;
  registerHooks({
    resolve(spec, ctx, next) {
      try {
        return next(spec, ctx);
      } catch (e) {
        if (spec.startsWith(".") && !/\.[a-z]+$/.test(spec)) return next(spec + ".ts", ctx);
        throw e;
      }
    },
  });
}

export const readLocale = (ext = EXT) => JSON.parse(fs.readFileSync(path.join(ext, "locales/en.default.json"), "utf8"));

/** Copies the extension's JS and CSS next to the rendered pages (they load "assets/<file>"). */
export function copyAssets(dir, ext = EXT) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(path.join(ext, "assets"))) fs.copyFileSync(path.join(ext, "assets", f), path.join(dir, f));
}

// Named filter arguments arrive as [key, value] pairs.
const named = (args) => Object.fromEntries(args.filter(Array.isArray));
const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
    .join(" ");

/**
 * A LiquidJS engine for the extension's blocks and snippets, with the Shopify filters and tags the
 * blocks use. `filters` replaces or adds filters (a harness can keep its own simpler versions).
 */
export function createEngine(Liquid, { ext = EXT, locale = readLocale(ext), money = (c) => `$${(Number(c) / 100).toFixed(2)}`, filters = {} } = {}) {
  const engine = new Liquid({ root: [path.join(ext, "blocks"), path.join(ext, "snippets")], extname: ".liquid", strictFilters: true });
  engine.registerTag("schema", {
    parse(token, remain) {
      const stream = this.liquid.parser.parseStream(remain);
      stream.on("tag:endschema", () => stream.stop()).on("template", () => {}).on("end", () => { throw new Error("schema not closed"); });
      stream.start();
    },
    *render() {},
  });
  // {% form 'contact' %} … {% endform %}: a plain form posting to /contact, with an empty "form" object.
  engine.registerTag("form", {
    parse(token, remain) {
      this.cls = (token.args.match(/class:\s*'([^']*)'/) || [])[1] || "";
      this.tpls = [];
      const stream = this.liquid.parser.parseStream(remain);
      stream.on("tag:endform", () => stream.stop()).on("template", (t) => this.tpls.push(t)).on("end", () => { throw new Error("form not closed"); });
      stream.start();
    },
    *render(ctx, emitter) {
      emitter.write(`<form method="post" action="/contact" class="${this.cls}"><input type="hidden" name="form_type" value="contact">`);
      ctx.push({ form: { posted_successfully: false, errors: null, email: "", body: "" } });
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      ctx.pop();
      emitter.write("</form>");
    },
  });
  const base = {
    money,
    image_url: (img, ...args) => {
      const src = img?.src ?? img?.preview_image?.src ?? String(img ?? "");
      const o = named(args);
      return src.startsWith("data:") || src.endsWith(".svg") ? src : `${src}${src.includes("?") ? "&" : "?"}width=${o.width ?? o.height ?? 720}`;
    },
    image_tag: (url, ...args) => {
      const o = named(args);
      return `<img ${attrs({ src: url, alt: o.alt ?? "", class: o.class, loading: o.loading ?? "lazy", fetchpriority: o.fetchpriority, width: o.width, height: o.height, sizes: o.sizes })}>`;
    },
    video_tag: (video, ...args) => {
      const o = named(args);
      const flags = ["muted", "loop", "playsinline", "autoplay", "controls"].filter((k) => o[k]).join(" ");
      return `<video ${attrs({ class: o.class, preload: o.preload, poster: video.preview_image?.src })} ${flags}><source src="${video.sources[0].url}" type="video/mp4"></video>`;
    },
    placeholder_svg_tag: (name, cls) => `<svg class="${cls}" viewBox="0 0 525 300" xmlns="http://www.w3.org/2000/svg"><rect width="525" height="300"/></svg>`,
    asset_url: (name) => `assets/${name}`,
    default_errors: (e) => `<ul><li>${e}</li></ul>`,
    payment_type_svg_tag: (type, ...args) =>
      `<svg class="${named(args).class ?? ""}" viewBox="0 0 38 24" role="img" aria-label="${type}"><rect width="38" height="24" rx="3" fill="#fff" stroke="#ccc"/><text x="19" y="15" font-size="7" text-anchor="middle" font-family="Arial" font-weight="700">${String(type).toUpperCase()}</text></svg>`,
    handleize: (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    color_brightness: (hex) => {
      const m = String(hex).replace("#", "").match(/../g) || ["0", "0", "0"];
      const [r, g, b] = m.map((x) => parseInt(x, 16));
      return (r * 299 + g * 587 + b * 114) / 1000;
    },
    t: (key, ...args) => {
      const o = named(args);
      let v = key.split(".").reduce((x, k) => (x ? x[k] : undefined), locale) ?? key;
      if (v && typeof v === "object") v = o.count === 1 ? v.one : v.other;
      return String(v).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => o[k] ?? "");
    },
  };
  for (const [name, fn] of Object.entries({ ...base, ...filters })) engine.registerFilter(name, fn);
  return engine;
}

// ---------------------------------------------------------------- mock data helpers --
export const f = (value) => ({ value });
/** A metaobject as Liquid sees it: fields wrapped in { value }, the handle under system. */
export const mo = (handle, fields) => ({ system: { handle }, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, f(v)])) });
/** shop.metaobjects[type]: by handle, plus .values in order. */
export const collectionOf = (items) => Object.assign(Object.fromEntries(items.map((m) => [m.system.handle, m])), { values: items });

/** Block settings = schema defaults (what a merchant gets right after adding the block). */
export function defaults(name, ext = EXT) {
  const src = fs.readFileSync(path.join(ext, "blocks", `${name}.liquid`), "utf8");
  const schema = JSON.parse(src.split("{% schema %}")[1].split("{% endschema %}")[0]);
  return Object.fromEntries(schema.settings.filter((s) => s.id).map((s) => [s.id, s.default ?? (s.type === "checkbox" ? false : "")]));
}
