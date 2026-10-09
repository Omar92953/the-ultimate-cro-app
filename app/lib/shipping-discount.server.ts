/**
 * The free shipping bar's goal as a real Shopify discount: one automatic "free shipping" discount
 * for orders from the goal amount (store currency; Shopify converts it for other currencies).
 * Created or updated when the bar is saved, switched off when the bar or the option is off.
 */
import { AdminError, gql, type AdminClient } from "./admin.server";

export const FREE_SHIPPING_TITLE = "CRO Toolbox free shipping";

type Found = { id: string; status: string; goal: number | null } | null;

async function findOurs(admin: AdminClient): Promise<Found> {
  const data = await gql(
    admin,
    `#graphql
    query CroFreeShippingDiscount {
      automaticDiscountNodes(first: 100, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id
          automaticDiscount {
            ... on DiscountAutomaticFreeShipping {
              title
              status
              minimumRequirement { ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } } }
            }
          }
        }
      }
    }`,
  );
  for (const n of data.automaticDiscountNodes?.nodes ?? []) {
    const d = n.automaticDiscount;
    if (d?.title === FREE_SHIPPING_TITLE) return { id: n.id, status: d.status, goal: d.minimumRequirement?.greaterThanOrEqualToSubtotal ? Number(d.minimumRequirement.greaterThanOrEqualToSubtotal.amount) : null };
  }
  return null;
}

function userErrors(result: { userErrors?: { message: string }[] } | undefined) {
  const e = result?.userErrors ?? [];
  if (e.length) throw new AdminError(e.map((x) => x.message).join(" "));
}

export type FreeShippingStatus = { on: boolean; goal: number | null; id: string | null };

export async function getFreeShippingDiscount(admin: AdminClient): Promise<FreeShippingStatus> {
  const f = await findOurs(admin);
  return { on: f?.status === "ACTIVE", goal: f?.goal ?? null, id: f?.id ?? null };
}

/** Makes the discount match the bar: active with this minimum, or switched off. */
export async function syncFreeShippingDiscount(admin: AdminClient, want: { on: boolean; goal: number }): Promise<FreeShippingStatus> {
  const found = await findOurs(admin);
  if (!want.on) {
    if (found && found.status === "ACTIVE") {
      const d = await gql(
        admin,
        `#graphql
        mutation CroFreeShippingOff($id: ID!) { discountAutomaticDeactivate(id: $id) { userErrors { field message } } }`,
        { id: found.id },
      );
      userErrors(d.discountAutomaticDeactivate);
    }
    return { on: false, goal: found?.goal ?? null, id: found?.id ?? null };
  }

  const input = {
    title: FREE_SHIPPING_TITLE,
    minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: want.goal.toFixed(2) } },
    destination: { all: true },
    combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: false },
    appliesOnOneTimePurchase: true,
    appliesOnSubscription: false,
  };
  let id = found?.id ?? null;
  if (found) {
    const d = await gql(
      admin,
      `#graphql
      mutation CroFreeShippingUpdate($id: ID!, $d: DiscountAutomaticFreeShippingInput!) {
        discountAutomaticFreeShippingUpdate(id: $id, freeShippingAutomaticDiscount: $d) { userErrors { field message } }
      }`,
      { id: found.id, d: input },
    );
    userErrors(d.discountAutomaticFreeShippingUpdate);
    if (found.status !== "ACTIVE") {
      const a = await gql(
        admin,
        `#graphql
        mutation CroFreeShippingOn($id: ID!) { discountAutomaticActivate(id: $id) { userErrors { field message } } }`,
        { id: found.id },
      );
      userErrors(a.discountAutomaticActivate);
    }
  } else {
    const d = await gql(
      admin,
      `#graphql
      mutation CroFreeShippingCreate($d: DiscountAutomaticFreeShippingInput!) {
        discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $d) {
          automaticDiscountNode { id }
          userErrors { field message }
        }
      }`,
      { d: { ...input, startsAt: new Date().toISOString() } },
    );
    userErrors(d.discountAutomaticFreeShippingCreate);
    id = d.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id ?? null;
  }
  return { on: true, goal: want.goal, id };
}
