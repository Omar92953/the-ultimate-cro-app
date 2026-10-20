import type { APIRoute, GetStaticPaths } from "astro";
import { ALL_PAGES, type PageMeta } from "../../lib/pages";
import { contentPages } from "../../lib/content";
import { KEYWORD_META } from "../../lib/keywords";
import { ALTERNATIVES, altMeta } from "../../lib/alternatives";
import { RECIPE_META } from "../../lib/recipes";
import { ogPng } from "../../lib/og";

export const getStaticPaths: GetStaticPaths = async () =>
  [...ALL_PAGES, ...KEYWORD_META, ...ALTERNATIVES.map(altMeta), ...RECIPE_META, ...(await contentPages())].map((page) => ({ params: { slug: page.slug }, props: { page } }));

export const GET: APIRoute<{ page: PageMeta }> = async ({ props }) =>
  new Response(new Uint8Array(await ogPng(props.page)), { headers: { "Content-Type": "image/png" } });
