import type { APIRoute, GetStaticPaths } from "astro";
import { ALL_PAGES, type PageMeta } from "../../lib/pages";
import { contentPages, TUTORIALS_PAGE } from "../../lib/content";
import { KEYWORD_META } from "../../lib/keywords";
import { ALTERNATIVES, altMeta } from "../../lib/alternatives";
import { RECIPE_META } from "../../lib/recipes";
import { ogPng } from "../../lib/og";

/** Every page that is built gets its share image, the Tutorials page included while it has no videos yet. */
export const getStaticPaths: GetStaticPaths = async () => {
  const pages = [...ALL_PAGES, ...KEYWORD_META, ...ALTERNATIVES.map(altMeta), ...RECIPE_META, ...(await contentPages()), TUTORIALS_PAGE];
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  return [...bySlug.values()].map((page) => ({ params: { slug: page.slug }, props: { page } }));
};

export const GET: APIRoute<{ page: PageMeta }> = async ({ props }) =>
  new Response(new Uint8Array(await ogPng(props.page)), { headers: { "Content-Type": "image/png" } });
