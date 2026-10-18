/**
 * Keyword pages (docs/plans/seo-geo.md §2): one page answers one search, at /<slug>/.
 *
 * Each page is one data file in src/keywords/<slug>.ts (default export: a KeywordPage), shown by
 * src/pages/[keyword].astro. Prices, plans and feature names come from the app's own files through
 * ./app, so a page never drifts from what the app does. Adding a page = adding one file; the footer's
 * Solutions column, the sitemap and the share image pick it up.
 *
 * The build fails when a page's title or description lacks its keyword, or when it links to a help
 * guide, use case or article that doesn't exist (checked in [keyword].astro).
 */
import type { FeatureKey, RecipeKey } from "./app";
import type { PageMeta } from "./pages";
import type { QA } from "../components/Faq.astro";

/** A block of the page body: a heading, paragraphs, a bullet list and/or numbered steps, then closing paragraphs. */
export type KeywordSection = { heading: string; paragraphs?: string[]; list?: string[]; steps?: string[]; after?: string[] };

export type KeywordPage = {
  /** The address: /<slug>/. */
  slug: string;
  /** Position in the footer's Solutions column. */
  order: number;
  /** Footer link and breadcrumb text. */
  menu: string;
  /** The main search phrase. The title and the meta description must contain it. */
  keyword: string;
  /** <title> (" | CRO Toolbox" is added) and meta description. */
  title: string;
  description: string;
  /** Short line on the share image. */
  ogTitle: string;
  /** Eyebrow above the H1. */
  kicker: string;
  h1: string;
  /** The direct answer, two sentences, right under the H1. */
  answer: string;
  /** "Last updated" (YYYY-MM-DD). */
  updated: string;
  /** Screenshot from src/assets ("features/<feature>" or "bundles/<recipe>"). */
  shot: { name: string; alt: string; caption: string };
  sections: KeywordSection[];
  table?: { heading: string; caption: string; head: string[]; rows: string[][]; note?: string };
  /** App features the page is about: their cards, plans and feature page links. */
  features: FeatureKey[];
  /** Live demo pages (crotoolbox.com/demo/…). */
  demos: { label: string; feature: FeatureKey; recipe?: RecipeKey }[];
  /** Help guides (src/content/help/<slug>.md), use cases (src/lib/usecases.ts) and articles (src/content/blog). */
  help: string[];
  useCases: string[];
  articles: string[];
  /** Other keyword pages to link to (slugs). Links to pages that don't exist yet are left out. */
  related?: string[];
  faq: QA[];
};

/** Every keyword page, in footer order. */
const files = import.meta.glob<{ default: KeywordPage }>("../keywords/*.ts", { eager: true });
export const KEYWORD_PAGES: KeywordPage[] = Object.values(files)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order);

export const keywordPath = (p: Pick<KeywordPage, "slug">) => `/${p.slug}/`;

export const keywordMeta = (p: KeywordPage): PageMeta => ({
  slug: `kw-${p.slug}`,
  path: keywordPath(p),
  title: p.title,
  description: p.description,
  ogTitle: p.ogTitle,
  ogKicker: p.kicker,
});
export const KEYWORD_META: PageMeta[] = KEYWORD_PAGES.map(keywordMeta);

for (const p of KEYWORD_PAGES) {
  const k = p.keyword.toLowerCase();
  if (!p.title.toLowerCase().includes(k)) throw new Error(`Keyword page ${p.slug}: the title must contain "${p.keyword}"`);
  if (!p.description.toLowerCase().includes(k)) throw new Error(`Keyword page ${p.slug}: the description must contain "${p.keyword}"`);
  if (p.description.length > 200) throw new Error(`Keyword page ${p.slug}: the description is ${p.description.length} characters (keep it under 200)`);
  if (p.faq.length < 4 || p.faq.length > 6) throw new Error(`Keyword page ${p.slug}: 4 to 6 questions, not ${p.faq.length}`);
}
