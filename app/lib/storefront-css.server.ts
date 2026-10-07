/** The storefront stylesheets (and the header script), read on the server so app previews look and behave exactly like the store. */
import fs from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();
export function storefrontCss(file: "ucs-contact.css" | "ucs-sections.css" | "ucs-header.css" | "ucs-header.js") {
  if (process.env.NODE_ENV === "production" && cache.has(file)) return cache.get(file)!;
  const css = fs.readFileSync(path.join(process.cwd(), "extensions/cro-storefront/assets", file), "utf8");
  cache.set(file, css);
  return css;
}
