import type { APIRoute, GetStaticPaths } from "astro";
import { ALL_PAGES, type PageMeta } from "../../lib/pages";
import { ogPng } from "../../lib/og";

export const getStaticPaths: GetStaticPaths = () => ALL_PAGES.map((page) => ({ params: { slug: page.slug }, props: { page } }));

export const GET: APIRoute<{ page: PageMeta }> = async ({ props }) =>
  new Response(new Uint8Array(await ogPng(props.page)), { headers: { "Content-Type": "image/png" } });
