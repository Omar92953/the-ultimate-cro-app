/**
 * The theme editor deep links (addAppBlockId=<api key>/<block>) only work when SHOPIFY_API_KEY is the
 * app's own client id (shopify.app.toml). A mismatch (e.g. keys from another app on the host) makes
 * every "Add to theme" button open the editor without adding anything, so say so once at startup.
 */
import fs from "node:fs";
import path from "node:path";

export function warnIfApiKeyDiffers() {
  try {
    const toml = fs.readFileSync(path.join(process.cwd(), "shopify.app.toml"), "utf8");
    const clientId = /^client_id\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    const key = process.env.SHOPIFY_API_KEY;
    if (clientId && key && clientId !== key) {
      console.warn(`SHOPIFY_API_KEY (${key.slice(0, 6)}…) does not match client_id in shopify.app.toml (${clientId.slice(0, 6)}…): "Add to theme" links will not add blocks. Fix the environment variable on the host.`);
    } else if (!key) {
      console.warn("SHOPIFY_API_KEY is not set: theme editor links cannot add blocks.");
    }
  } catch {
    // shopify.app.toml is not on the host (not an error).
  }
}
