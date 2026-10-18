/**
 * The two store pages behind Tracking & Returns ("Track your order" and "Returns"). The app creates them
 * (pageCreate) and remembers their handles in $app:cro_design "order_pages"; the Order pages block
 * (ucs-order-page.liquid) compares the page it is on with these handles, so one block in the theme's page
 * template shows the right content on each page and nothing on any other page.
 */
import { AdminError, gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { sectionLinks } from "./sections.server";

export type OrderPageKind = "track" | "returns" | "wishlist";
export type StorePage = { id: string; handle: string; title: string };
export type OrderPages = { track: StorePage | null; returns: StorePage | null; wishlist: StorePage | null };

const TITLES: Record<OrderPageKind, { title: string; handle: string }> = {
  track: { title: "Track your order", handle: "track-your-order" },
  returns: { title: "Returns", handle: "returns" },
  wishlist: { title: "Wishlist", handle: "wishlist" },
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
  return { track: page(raw.track), returns: page(raw.returns), wishlist: page(raw.wishlist) };
}

const save = (admin: AdminClient, pages: OrderPages) =>
  upsert(admin, "$app:cro_design", "order_pages", {
    config: JSON.stringify({
      track: pages.track, returns: pages.returns, wishlist: pages.wishlist,
      // The block reads these flat handles.
      trackHandle: pages.track?.handle ?? "", returnsHandle: pages.returns?.handle ?? "", wishlistHandle: pages.wishlist?.handle ?? "",
    }),
  });

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

/** The theme file a page uses: templates/page.json, or page.<suffix>.json when the page has its own template. */
export const templateFile = (suffix: string | null | undefined) => (suffix ? `templates/page.${suffix}.json` : "templates/page.json");

/** What the Track, Returns and Wishlist screens need: editor links that open the app's own pages, and whether the block is in the template those pages really use. */
export async function orderPageContext(admin: AdminClient, shop: string, theme: { files: Record<string, string[]> } | null) {
  const pages = await getOrderPages(admin).catch(() => ({ track: null, returns: null, wishlist: null }) as OrderPages);
  const links = sectionLinks(shop, { trackHandle: pages.track?.handle, returnsHandle: pages.returns?.handle });
  // Each made page can have its own template (templateSuffix): the block must be in that one, not in any page.*.json.
  const made = ([pages.track, pages.returns, pages.wishlist].filter(Boolean) as StorePage[]).map((p) => p.id);
  let suffixes = new Map<string, string | null>();
  if (made.length) {
    const d = await gql(admin, `#graphql
      query CroPageTemplates($ids: [ID!]!) { nodes(ids: $ids) { ... on Page { id templateSuffix } } }`, { ids: made }).catch(() => null);
    suffixes = new Map((d?.nodes ?? []).filter(Boolean).map((n: { id: string; templateSuffix: string | null }) => [n.id, n.templateSuffix]));
  }
  const files = new Set(theme?.files.track ?? []);
  const hasBlock = (p: StorePage | null) => !p || files.has(templateFile(suffixes.get(p.id)));
  const inPageTemplate = !!theme && !!(pages.track || pages.returns) && hasBlock(pages.track) && hasBlock(pages.returns);
  const wishlistInTemplate = !!theme && !!pages.wishlist && hasBlock(pages.wishlist);
  const editor = (kind: OrderPageKind) => `https://${shop}/admin/themes/current/editor?template=${encodeURIComponent(suffixes.get(pages[kind]?.id ?? "") ? `page.${suffixes.get(pages[kind]!.id)}` : "page")}&previewPath=${encodeURIComponent(`/pages/${pages[kind]?.handle ?? TITLES[kind].handle}`)}`;
  return { pages, links, inPageTemplate, wishlistInTemplate, editor };
}
