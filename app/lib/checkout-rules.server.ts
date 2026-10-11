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
  const p = ours(data.paymentCustomizations.nodes), d = ours(data.deliveryCustomizations.nodes), v = ours(data.validations.nodes);
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
