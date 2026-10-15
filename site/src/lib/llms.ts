/**
 * /llms.txt and /llms-full.txt: plain text summaries of CRO Toolbox for AI assistants, built from the
 * same sources as the pages (plans.ts, catalog.ts, bundle-recipes.ts), so the facts always match.
 */
import { SITE_URL, SITE_NAME, INSTALL_URL } from "./site";
import { ALL_PAGES } from "./pages";
import { plans, SITE_AREAS, BUNDLE_RECIPES, featureTitle, featureAbout, plain, money, ordersText, trialDays, GUARANTEE, PLANS } from "./app";

const url = (path: string) => `${SITE_URL}${path}`;

const SUMMARY = `${SITE_NAME} is a Shopify app that brings upsells, cross sells, six kinds of bundles, discounts, a cart drawer, storefront widgets and sections, checkout rules and analytics into one app. It works with any Online Store 2.0 theme without code: sections and widgets are theme app blocks placed in the theme editor.`;

function pricing(): string[] {
  return plans.map((p) => {
    const price = p.monthly ? `${money(p.monthly)} a month or ${money(p.yearly)} a year, ${p.trialDays} day free trial` : "free";
    return `- ${p.name}: ${price}. ${ordersText(p)}. ${plain(p.job)} Includes: ${p.highlights.map(plain).join(", ")}.`;
  });
}

export function llmsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SUMMARY} Plans: ${plans.map((p) => p.monthly ? `${p.name} ${money(p.monthly)}/month` : `${p.name} (free)`).join(", ")}. Every paid plan has a ${trialDays} day free trial.`,
    "",
    "## Pages",
    "",
    ...ALL_PAGES.map((p) => `- [${p.title.includes(SITE_NAME) ? "Home" : p.title}](${url(p.path)}): ${p.description}`),
    ...(INSTALL_URL ? [`- [Shopify App Store listing](${INSTALL_URL})`] : []),
    "",
    "## Optional",
    "",
    `- [Full details for AI assistants](${url("/llms-full.txt")}): every feature, plan limit and bundle type in plain text.`,
    "",
  ].join("\n");
}

export function llmsFullTxt(): string {
  const out: string[] = [`# ${SITE_NAME}`, "", SUMMARY, "", `Website: ${SITE_URL}`];
  if (INSTALL_URL) out.push(`Install: ${INSTALL_URL}`);
  out.push("", "## Pricing", "", ...pricing(), "", `${GUARANTEE} Billing runs through Shopify. The orders limit counts all store orders in a calendar month and is soft: going over shows a reminder, nothing switches off. The ${PLANS.free.name} plan allows ${PLANS.free.limits.offerSlots} offers switched on at once; paid plans have unlimited offers.`);
  out.push("", "## Features by area");
  for (const a of SITE_AREAS) {
    out.push("", `### ${a.title}`, "", a.intro);
    for (const k of a.features) out.push(`- ${featureTitle(k)}: ${featureAbout(k)}`);
  }
  out.push("", "## Bundle types", "", "All six bundle types are included on every plan, within the plan's offer slots. Shopify applies bundle prices at checkout.", "");
  BUNDLE_RECIPES.forEach((r, i) => out.push(`${i + 1}. ${plain(r.title)}: ${plain(r.about)} ${plain(r.best)}.`));
  out.push(
    "",
    "## How it works",
    "",
    "1. Install the app from the Shopify App Store.",
    "2. Create an offer or open a storefront feature; set it up with a live preview.",
    "3. Click Add to theme: the theme editor opens with the block ready to place and save. No code.",
    "",
    "## Facts",
    "",
    "- Works with any Online Store 2.0 theme. It never edits theme code.",
    "- Discounts and bundle prices are real Shopify discounts applied at checkout.",
    "- Widgets read the store's own data as the page loads; only shopper forms (reviews, back in stock, returns, order lookup) reach the app's server, through Shopify. Checkout logic runs in Shopify Functions.",
    "- Settings are saved in the merchant's own store. The app's database holds only login sessions, back in stock requests and return requests.",
    "",
  );
  return out.join("\n");
}
