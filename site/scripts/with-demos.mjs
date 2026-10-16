/**
 * Runs after `astro build`: builds the live demos (../demos) and copies them into dist/demo/, so the one
 * Cloudflare project serves the website and https://crotoolbox.com/demo/. A failing demos build fails the
 * website build. The demos are hidden from search (noindex pages, X-Robots-Tag in public/_headers,
 * Disallow in robots.txt, nothing in the sitemap) and the website never links to them.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const demos = path.join(here, "../../demos");
const dist = path.join(here, "../dist");
const run = (args) => execFileSync("npm", args, { cwd: demos, stdio: "inherit" });

// The demos have their own dependencies (liquidjs); CI = Cloudflare or CI=true installs from the lockfile.
run(["ci", "--no-audit", "--no-fund"]);
run(["run", "build"]);

const from = path.join(demos, "dist/demo");
if (!fs.existsSync(path.join(from, "index.html"))) throw new Error("demos build produced no dist/demo");
fs.rmSync(path.join(dist, "demo"), { recursive: true, force: true });
fs.cpSync(from, path.join(dist, "demo"), { recursive: true });
console.log(`✓ demos copied to site/dist/demo (${fs.readdirSync(path.join(dist, "demo")).length} entries)`);
