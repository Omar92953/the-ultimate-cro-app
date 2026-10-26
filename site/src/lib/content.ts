/** Page titles, addresses and reading time for articles (/blog/) and help guides (/help/). */
import { getCollection, type CollectionEntry } from "astro:content";
import { CATEGORIES } from "../content.config";
import type { PageMeta } from "./pages";
import { TUTORIALS_READY } from "../../../app/lib/tutorials";

export type Article = CollectionEntry<"blog">;
export type Guide = CollectionEntry<"help">;

export const categorySlug = (c: string) => c.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const CATEGORY_LIST = CATEGORIES.map((name) => ({ name, slug: categorySlug(name), path: `/blog/category/${categorySlug(name)}/` }));

export const articlePath = (a: Article) => `/blog/${a.id}/`;
export const guidePath = (g: Guide) => `/help/${g.id}/`;

/** Newest first. */
export async function articles(): Promise<Article[]> {
  return (await getCollection("blog")).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
export async function guides(): Promise<Guide[]> {
  return (await getCollection("help")).sort((a, b) => a.data.order - b.data.order);
}

/** About 220 words a minute. */
export const readingMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));

export const articleMeta = (a: Article): PageMeta => ({ slug: `blog-${a.id}`, path: articlePath(a), title: a.data.title, description: a.data.description, ogKicker: a.data.category });
export const guideMeta = (g: Guide): PageMeta => ({ slug: `help-${g.id}`, path: guidePath(g), title: `${g.data.title}: help`, description: g.data.description, ogTitle: g.data.title, ogKicker: "Help center" });

export const BLOG_PAGE: PageMeta = {
  slug: "blog",
  path: "/blog/",
  title: "Guides for Shopify stores: bundles, upsells and more",
  description: "Practical guides on bundles, upsells, product pages, the cart and checkout for Shopify stores, with real steps.",
  ogTitle: "Guides for Shopify stores",
  ogKicker: "Guides",
};
export const categoryMeta = (c: (typeof CATEGORY_LIST)[number]): PageMeta => ({
  slug: `blog-cat-${c.slug}`,
  path: c.path,
  title: `${c.name}: guides for Shopify stores`,
  description: `Guides about ${c.name.toLowerCase()} for Shopify stores, from the CRO Toolbox team.`,
  ogTitle: c.name,
  ogKicker: "Guides",
});
export const HELP_PAGE: PageMeta = {
  slug: "help",
  path: "/help/",
  title: "Help center",
  description: "How to set up and use CRO Toolbox: getting started, offers, bundles, the cart, storefront sections, checkout rules and analytics.",
  ogTitle: "Help center",
  ogKicker: "Help",
};
export const TUTORIALS_PAGE: PageMeta = {
  slug: "tutorials",
  path: "/tutorials/",
  title: "Video tutorials",
  description: "Short video tutorials for setting up CRO Toolbox on your Shopify store.",
  ogTitle: "Video tutorials",
  ogKicker: "Tutorials",
};

/** Every content page, for share images and llms.txt. */
export async function contentPages(): Promise<PageMeta[]> {
  return [BLOG_PAGE, HELP_PAGE, ...(TUTORIALS_READY.length ? [TUTORIALS_PAGE] : []), ...CATEGORY_LIST.map(categoryMeta), ...(await articles()).map(articleMeta), ...(await guides()).map(guideMeta)];
}
