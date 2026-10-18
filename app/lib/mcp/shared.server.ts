/** Small helpers shared by the MCP build tools (offers, discounts, bundles). */
import { gql } from "../admin.server";
import type { Ref } from "../types";
import type { ToolContext } from "./tools.server";

export const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
export const adminHandle = (shop: string) => shop.replace(/\.myshopify\.com$/, "");
export async function refs(ctx: ToolContext, ids: unknown, what: "Product" | "Collection"): Promise<Ref[]> {
  const list = Array.isArray(ids) ? ids.map(String).filter((x) => new RegExp(`^gid://shopify/${what}/\\d+$`).test(x)).slice(0, 50) : [];
  if (!list.length) return [];
  const d = await gql(ctx.admin, `#graphql
    query CroMcpRefs($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id title handle } ... on Collection { id title handle } } }`, { ids: list });
  return (d.nodes as ({ id: string; title: string; handle: string } | null)[]).filter((n): n is { id: string; title: string; handle: string } => !!n).map((n) => ({ id: n.id, title: n.title, handle: n.handle }));
}
