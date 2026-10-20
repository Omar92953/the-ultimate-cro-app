import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { SITE_URL } from "./src/lib/site";
import { lastmodMap } from "./scripts/lastmod.mjs";

const lastmod: (path: string) => string | undefined = lastmodMap();

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "always",
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/404"),
      // <lastmod> per URL (scripts/lastmod.mjs): what changed gets re-crawled first.
      serialize: (item) => {
        const d = lastmod(new URL(item.url).pathname);
        return d ? { ...item, lastmod: d } : item;
      },
    }),
  ],
  // The site reads prices and features from the app's own files (../app/lib).
  vite: { server: { fs: { allow: [".."] } } },
});
