/**
 * The <lastmod> date of each sitemap URL, so search engines (Bing first) re-crawl what changed.
 *   - articles: the "updated" or "date" in their front matter
 *   - keyword pages: their "updated" field (src/keywords/<slug>.ts)
 *   - help guides and the alternative pages: the last commit that changed their file
 *   - every other page: the last commit that changed the site's pages, layouts, components or the app
 *     files the site reads (plans, catalog, bundle recipes)
 * Uses git; when git isn't there (or a file has no history) the URL simply has no lastmod.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repo = new URL("../../", import.meta.url).pathname;
const site = join(repo, "site");

const gitDate = (...paths) => {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...paths], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out ? new Date(out).toISOString() : undefined;
  } catch {
    return undefined;
  }
};
const day = (d) => (d ? new Date(`${d}T12:00:00Z`).toISOString() : undefined);

export function lastmodMap() {
  const map = new Map();
  const blog = join(site, "src/content/blog");
  if (existsSync(blog))
    for (const f of readdirSync(blog).filter((f) => f.endsWith(".md"))) {
      const fm = readFileSync(join(blog, f), "utf8").split("---")[1] ?? "";
      const d = fm.match(/^updated:\s*"?(\d{4}-\d{2}-\d{2})/m)?.[1] ?? fm.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})/m)?.[1];
      map.set(`/blog/${f.replace(/\.md$/, "")}/`, day(d));
    }
  const keywords = join(site, "src/keywords");
  if (existsSync(keywords))
    for (const f of readdirSync(keywords).filter((f) => f.endsWith(".ts"))) {
      const src = readFileSync(join(keywords, f), "utf8");
      map.set(`/${src.match(/slug:\s*"([^"]+)"/)?.[1]}/`, day(src.match(/updated:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1]));
    }
  const help = join(site, "src/content/help");
  if (existsSync(help)) for (const f of readdirSync(help).filter((f) => f.endsWith(".md"))) map.set(`/help/${f.replace(/\.md$/, "")}/`, gitDate(join(help, f)));
  const alt = gitDate(join(site, "src/lib/alternatives.ts"), join(site, "src/pages/compare/[alternative].astro"));
  const rest = gitDate(
    join(site, "src/pages"),
    join(site, "src/layouts"),
    join(site, "src/components"),
    join(site, "src/lib"),
    join(repo, "app/lib/plans.ts"),
    join(repo, "app/lib/catalog.ts"),
    join(repo, "app/lib/bundle-recipes.ts"),
  );
  return (path) => (map.has(path) ? map.get(path) : /^\/compare\/[^/]+-alternative\/$/.test(path) ? alt : rest);
}
