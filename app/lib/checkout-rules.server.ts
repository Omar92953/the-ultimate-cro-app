/**
 * Reads and saves the checkout rules (see checkout-rules.ts). Each kind has one customization in the
 * store, made by the app on the first save:
 *   payment    → paymentCustomizationCreate (function cro-payment)
 *   delivery   → deliveryCustomizationCreate (function cro-delivery)
 *   validation → validationCreate (function cro-validation)
 * Two metafields on it: `$app:rules` (the app's full list, with switched-off rules and product names)
 * and `$app:function-configuration` (what the Function reads).
 */
import { AdminError, gql, type AdminClient } from "./admin.server";
import { cleanChangeRules, cleanLimitRules, toFunctionConfig, type ChangeRule, type CheckoutKind, type LimitRule, type RuleSet } from "./checkout-rules";

const TITLES: Record<CheckoutKind, string> = {
  payment: "CRO Toolbox payment rules",
  delivery: "CRO Toolbox delivery rules",
  validation: "CRO Toolbox order limits",
};

const NODE = `id title enabled shopifyFunction { app { apiKey } } metafield(namespace: "$app", key: "rules") { value }`;

export type CheckoutRules = { payment: RuleSet<ChangeRule>; delivery: RuleSet<ChangeRule>; validation: RuleSet<LimitRule> };

type Node = { id: string; title: string; enabled: boolean; shopifyFunction: { app: { apiKey: string } } | null; metafield: { value: string } | null };

const parse = (v: string | undefined) => {
  try {
    return JSON.parse(v ?? "[]");
  } catch {
    return [];
  }
};

export async function getCheckoutRules(admin: AdminClient): Promise<CheckoutRules> {
  const data = await gql(
    admin,
    `#graphql
    query CroCheckoutRules {
      paymentCustomizations(first: 25) { nodes { ${NODE} } }
      deliveryCustomizations(first: 25) { nodes { ${NODE} } }
      validations(first: 25) { nodes { ${NODE} } }
    }`,
  );
  const apiKey = process.env.SHOPIFY_API_KEY;
  const ours = (nodes: Node[]) => nodes.find((x) => x.shopifyFunction?.app?.apiKey === apiKey) ?? null;
  // The bundle guard (see syncBundleGuard) is also one of our validations, but has no `rules`.
  const p = ours(data.paymentCustomizations.nodes), d = ours(data.deliveryCustomizations.nodes), v = ours(data.validations.nodes.filter((x: Node) => x.title !== GUARD_TITLE));
  return {
    payment: { id: p?.id ?? null, enabled: p?.enabled ?? true, rules: cleanChangeRules(parse(p?.metafield?.value)) },
    delivery: { id: d?.id ?? null, enabled: d?.enabled ?? true, rules: cleanChangeRules(parse(d?.metafield?.value)) },
    validation: { id: v?.id ?? null, enabled: v?.enabled ?? true, rules: cleanLimitRules(parse(v?.metafield?.value)) },
  };
}

const userErrors = (errors: { message: string }[] | undefined) => {
  if (errors?.length) throw new AdminError(errors.map((e) => e.message).join(" "));
};

export async function saveCheckoutRules(admin: AdminClient, kind: CheckoutKind, rawRules: unknown, enabled: boolean) {
  const rules = kind === "validation" ? cleanLimitRules(rawRules) : cleanChangeRules(rawRules);
  const metafields = [
    { namespace: "$app", key: "rules", type: "json", value: JSON.stringify(rules) },
    { namespace: "$app", key: "function-configuration", type: "json", value: JSON.stringify(toFunctionConfig(kind, rules)) },
  ];
  const current = (await getCheckoutRules(admin))[kind];
  const title = TITLES[kind];

  if (current.id) {
    const set = await gql(
      admin,
      `#graphql
      mutation CroCheckoutRulesSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { userErrors { field message } }
      }`,
      { metafields: metafields.map((m) => ({ ...m, ownerId: current.id })) },
    );
    userErrors(set.metafieldsSet.userErrors);
    if (current.enabled !== enabled) {
      if (kind === "payment") {
        const r = await gql(admin, `#graphql
          mutation CroPaymentOn($id: ID!, $input: PaymentCustomizationInput!) { paymentCustomizationUpdate(id: $id, paymentCustomization: $input) { userErrors { field message } } }`, { id: current.id, input: { enabled } });
        userErrors(r.paymentCustomizationUpdate.userErrors);
      } else if (kind === "delivery") {
        const r = await gql(admin, `#graphql
          mutation CroDeliveryOn($id: ID!, $input: DeliveryCustomizationInput!) { deliveryCustomizationUpdate(id: $id, deliveryCustomization: $input) { userErrors { field message } } }`, { id: current.id, input: { enabled } });
        userErrors(r.deliveryCustomizationUpdate.userErrors);
      } else {
        const r = await gql(admin, `#graphql
          mutation CroValidationOn($id: ID!, $input: ValidationUpdateInput!) { validationUpdate(id: $id, validation: $input) { userErrors { field message } } }`, { id: current.id, input: { enable: enabled, title } });
        userErrors(r.validationUpdate.userErrors);
      }
    }
    return { id: current.id, enabled, rules };
  }

  let id: string | null = null;
  if (kind === "payment") {
    const r = await gql(admin, `#graphql
      mutation CroPaymentCreate($input: PaymentCustomizationInput!) { paymentCustomizationCreate(paymentCustomization: $input) { paymentCustomization { id } userErrors { field message } } }`, { input: { functionHandle: "cro-payment", title, enabled, metafields } });
    userErrors(r.paymentCustomizationCreate.userErrors);
    id = r.paymentCustomizationCreate.paymentCustomization?.id ?? null;
  } else if (kind === "delivery") {
    const r = await gql(admin, `#graphql
      mutation CroDeliveryCreate($input: DeliveryCustomizationInput!) { deliveryCustomizationCreate(deliveryCustomization: $input) { deliveryCustomization { id } userErrors { field message } } }`, { input: { functionHandle: "cro-delivery", title, enabled, metafields } });
    userErrors(r.deliveryCustomizationCreate.userErrors);
    id = r.deliveryCustomizationCreate.deliveryCustomization?.id ?? null;
  } else {
    // blockOnFailure false: if the Function ever errors, checkout goes ahead instead of being blocked.
    const r = await gql(admin, `#graphql
      mutation CroValidationCreate($input: ValidationCreateInput!) { validationCreate(validation: $input) { validation { id } userErrors { field message } } }`, { input: { functionHandle: "cro-validation", title, enable: enabled, blockOnFailure: false, metafields } });
    userErrors(r.validationCreate.userErrors);
    id = r.validationCreate.validation?.id ?? null;
  }
  return { id, enabled, rules };
}

const GUARD_TITLE = "CRO Toolbox bundle guard";

/**
 * Keeps the bundle guard validation (function cro-validation, `bundles` config) in step with the
 * store's mix and match bundle products, so a bundle product can't be bought alone at checkout.
 * Made only once there is a bundle; with no ids it stays and just lets everything through.
 */
export async function syncBundleGuard(admin: AdminClient, productIds: string[]) {
  const data = await gql(
    admin,
    `#graphql
    query CroBundleGuard { validations(first: 25) { nodes { id title enabled shopifyFunction { app { apiKey } } } } }`,
  );
  const apiKey = process.env.SHOPIFY_API_KEY;
  const guard = (data.validations.nodes as Pick<Node, "id" | "title" | "enabled" | "shopifyFunction">[]).find((x) => x.title === GUARD_TITLE && x.shopifyFunction?.app?.apiKey === apiKey);
  if (!guard && !productIds.length) return;
  if (guard && !productIds.length) {
    // Nothing to guard (or the guard is switched off): turn it off so it can't refuse anything.
    if (guard.enabled) {
      const r = await gql(admin, `#graphql
        mutation CroGuardOff($id: ID!, $input: ValidationUpdateInput!) { validationUpdate(id: $id, validation: $input) { userErrors { field message } } }`, { id: guard.id, input: { enable: false, title: GUARD_TITLE } });
      userErrors(r.validationUpdate.userErrors);
    }
    return;
  }
  const metafields = [{ namespace: "$app", key: "function-configuration", type: "json", value: JSON.stringify({ bundles: productIds }) }];
  if (guard) {
    const set = await gql(admin, `#graphql
      mutation CroGuardSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { field message } } }`, { metafields: metafields.map((m) => ({ ...m, ownerId: guard.id })) });
    userErrors(set.metafieldsSet.userErrors);
    if (!guard.enabled) {
      const r = await gql(admin, `#graphql
        mutation CroGuardOn($id: ID!, $input: ValidationUpdateInput!) { validationUpdate(id: $id, validation: $input) { userErrors { field message } } }`, { id: guard.id, input: { enable: true, title: GUARD_TITLE } });
      userErrors(r.validationUpdate.userErrors);
    }
    return;
  }
  // blockOnFailure false: if the Function ever errors, checkout goes ahead instead of being blocked.
  const r = await gql(admin, `#graphql
    mutation CroGuardCreate($input: ValidationCreateInput!) { validationCreate(validation: $input) { validation { id } userErrors { field message } } }`, { input: { functionHandle: "cro-validation", title: GUARD_TITLE, enable: true, blockOnFailure: false, metafields } });
  userErrors(r.validationCreate.userErrors);
}
