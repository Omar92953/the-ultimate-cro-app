import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { SITE_URL } from "./src/lib/site";

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "always",
  integrations: [sitemap({ filter: (page) => !page.includes("/404") })],
  // The site reads prices and features from the app's own files (../app/lib).
  vite: { server: { fs: { allow: [".."] } } },
});
