/**
 * The two store pages behind Tracking & Returns ("Track your order" and "Returns"). The app creates them
 * (pageCreate) and remembers their handles in $app:cro_design "order_pages"; the Order pages block
 * (ucs-order-page.liquid) compares the page it is on with these handles, so one block in the theme's page
 * template shows the right content on each page and nothing on any other page.
 */
import { AdminError, gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { sectionLinks } from "./sections.server";

export type OrderPageKind = "track" | "returns";
export type StorePage = { id: string; handle: string; title: string };
export type OrderPages = { track: StorePage | null; returns: StorePage | null };

const TITLES: Record<OrderPageKind, { title: string; handle: string }> = {
  track: { title: "Track your order", handle: "track-your-order" },
  returns: { title: "Returns", handle: "returns" },
};

export async function getOrderPages(admin: AdminClient): Promise<OrderPages> {
  const d = await gql(admin, `#graphql
    query CroOrderPages { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "order_pages" }) { field(key: "config") { value } } }`);
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(d.metaobjectByHandle?.field?.value ?? "{}") ?? {};
  } catch {
    raw = {};
  }
  const page = (v: unknown): StorePage | null => {
    const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    return o && typeof o.id === "string" && typeof o.handle === "string" ? { id: o.id, handle: o.handle, title: typeof o.title === "string" ? o.title : "" } : null;
  };
  return { track: page(raw.track), returns: page(raw.returns) };
}

const save = (admin: AdminClient, pages: OrderPages) =>
  upsert(admin, "$app:cro_design", "order_pages", { config: JSON.stringify({ track: pages.track?.handle ? pages.track : null, returns: pages.returns?.handle ? pages.returns : null, trackHandle: pages.track?.handle ?? "", returnsHandle: pages.returns?.handle ?? "" }) });

/** Makes the page (or adopts one that already has the handle), and remembers it. */
export async function createOrderPage(admin: AdminClient, kind: OrderPageKind): Promise<StorePage> {
  const want = TITLES[kind];
  const existing = await gql(admin, `#graphql
    query CroPageByHandle($q: String!) { pages(first: 1, query: $q) { nodes { id handle title } } }`, { q: `handle:${want.handle}` });
  let page: StorePage | null = existing.pages?.nodes?.[0] ?? null;
  if (!page) {
    const d = await gql(admin, `#graphql
      mutation CroPageCreate($page: PageCreateInput!) { pageCreate(page: $page) { page { id handle title } userErrors { field message code } } }`, { page: { title: want.title, handle: want.handle, body: "", isPublished: true } });
    page = d.pageCreate?.page ?? null;
  }
  if (!page?.id) throw new AdminError("Shopify didn't create the page. Please try again.");
  const all = await getOrderPages(admin);
  await save(admin, { ...all, [kind]: { id: page.id, handle: page.handle, title: page.title } });
  return page;
}

export const pageAdminUrl = (shop: string, p: StorePage) => `https://${shop}/admin/pages/${p.id.split("/").pop()}`;

/** What the Track and Returns screens need: editor links that open the app's own pages, and whether the block is in the page template. */
export async function orderPageContext(admin: AdminClient, shop: string, theme: { files: Record<string, string[]> } | null) {
  const pages = await getOrderPages(admin).catch(() => ({ track: null, returns: null }) as OrderPages);
  const links = sectionLinks(shop, { trackHandle: pages.track?.handle, returnsHandle: pages.returns?.handle });
  const inPageTemplate = (theme?.files.track ?? []).some((f) => /^templates\/page(\.[^/]+)?\.json$/.test(f));
  const editor = (kind: OrderPageKind) => `https://${shop}/admin/themes/current/editor?template=page&previewPath=${encodeURIComponent(`/pages/${pages[kind]?.handle ?? TITLES[kind].handle}`)}`;
  return { pages, links, inPageTemplate, editor };
}
