/**
 * The tiered rewards bar's "% off" steps as real Shopify discounts: one automatic discount per step
 * ("CRO Toolbox reward: 10% off from 200"), for orders from the step's amount. They don't combine
 * with each other, so Shopify applies the best one the cart reaches. Kept in step on every save:
 * steps removed or changed in the app are deleted in Shopify.
 */
import { AdminError, gql, type AdminClient } from "./admin.server";
import type { RewardTier } from "./shipping-bar";

const PREFIX = "CRO Toolbox reward";
const title = (t: RewardTier) => `${PREFIX}: ${t.percent}% off from ${t.goal}`;

function errors(result: { userErrors?: { message: string }[] } | undefined) {
  const e = result?.userErrors ?? [];
  if (e.length) throw new AdminError(e.map((x) => x.message).join(" "));
}

export async function syncRewardDiscounts(admin: AdminClient, tiers: RewardTier[], on: boolean) {
  const data = await gql(
    admin,
    `#graphql
    query CroRewardDiscounts { discountNodes(first: 100, query: "title:'CRO Toolbox reward*'") { nodes { id discount { ... on DiscountAutomaticBasic { title status } } } } }`,
  );
  const ours: { id: string; title: string }[] = (data.discountNodes?.nodes ?? [])
    .filter((n: { discount?: { title?: string } }) => n.discount?.title?.startsWith(PREFIX))
    .map((n: { id: string; discount: { title: string } }) => ({ id: n.id, title: n.discount.title }));
  const want = on ? tiers.filter((t) => t.reward === "percent") : [];
  const wanted = new Set(want.map(title));
  for (const d of ours) {
    if (wanted.has(d.title)) continue;
    const r = await gql(admin, `#graphql
      mutation CroRewardDelete($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }`, { id: d.id });
    errors(r.discountAutomaticDelete);
  }
  const have = new Set(ours.map((d) => d.title));
  for (const t of want) {
    if (have.has(title(t))) continue;
    const r = await gql(
      admin,
      `#graphql
      mutation CroRewardCreate($d: DiscountAutomaticBasicInput!) { discountAutomaticBasicCreate(automaticBasicDiscount: $d) { automaticDiscountNode { id } userErrors { field message } } }`,
      {
        d: {
          title: title(t),
          startsAt: new Date().toISOString(),
          minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: t.goal.toFixed(2) } },
          customerGets: { value: { percentage: t.percent / 100 }, items: { all: true } },
          combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true },
        },
      },
    );
    errors(r.discountAutomaticBasicCreate);
  }
}
