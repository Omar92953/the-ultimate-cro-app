import type { APIRoute } from "astro";
import { SITE_URL } from "../lib/site";

/**
 * Search engines and AI assistants (docs/plans/seo-geo.md section 6) may read every page except the
 * live demos. AI crawlers are named so one can be switched off later without touching the others.
 */
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "Bingbot"];

const block = (agent: string) => `User-agent: ${agent}\nAllow: /\nDisallow: /demo/\n`;

export const GET: APIRoute = () =>
  new Response([block("*"), ...AI_BOTS.map(block), `Sitemap: ${SITE_URL}/sitemap-index.xml\n`].join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
