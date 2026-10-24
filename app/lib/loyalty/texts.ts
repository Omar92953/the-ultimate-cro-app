/**
 * The rewards widget's words, grouped and named for the admin: Loyalty → Look edits them in the main language,
 * Loyalty → Languages in the store's other languages (`OTHER_TEXTS` only there).
 */
import { WIDGET_TEXTS } from "./config";

export type TextKey = keyof typeof WIDGET_TEXTS;
export const TEXT_GROUPS: { title: string; keys: [TextKey, string][] }[] = [
  { title: "Button and panel", keys: [["launcher", "Button"], ["title", "Panel title"], ["have", "Above the points"], ["pending", "Points on the way ({n})"], ["earn", "Ways to earn heading"], ["rewards", "Rewards heading"], ["history", "History heading"]] },
  { title: "Shoppers who aren't members", keys: [["guestTitle", "Title"], ["guestText", "Text"], ["guestPast", "Ordered before as a guest"], ["join", "Create an account"], ["signIn", "Sign in"], ["joinNow", "Join (signed in)"]] },
  { title: "Rewards", keys: [["get", "Get a reward"], ["more", "Points still needed ({n})"], ["code", "Codes heading"], ["copy", "Copy"], ["copied", "After copying"], ["apply", "Use the code"], ["applied", "After using"], ["credit", "After store credit"], ["error", "Something went wrong"]] },
  { title: "Ways to earn", keys: [["orderWay", "Orders"], ["signupWay", "Account"], ["firstWay", "First order"], ["reviewWay", "Product review"]] },
  { title: "Referrals", keys: [["referTitle", "Heading"], ["referText", "Text ({friend}, {gift})"], ["referLink", "Link label"], ["shareText", "Shared message ({friend})"], ["refBanner", "Friend arrives ({friend})"], ["referWay", "Ways to earn"], ["offPercent", "Percent off ({x})"], ["offAmount", "Amount off ({x})"], ["freeShip", "Free shipping"], ["creditGift", "Store credit gift ({x})"], ["email", "Share by email"]] },
  { title: "Points shop", keys: [["shopTitle", "Heading"], ["shopGet", "Get it ({price})"], ["shopSignIn", "Guests"], ["shopMore", "Points still needed ({n})"], ["shopHave", "Points so far ({have}, {n})"]] },
  { title: "On the store", keys: [["product", "Product page ({n})"], ["cart", "Cart ({n})"], ["earned", "Points went up ({n})"]] },
];

/** The words the Look page doesn't list (they show with tiers, birthdays, social follows and campaigns). */
export const OTHER_TEXTS: { title: string; keys: [TextKey, string][] } = {
  title: "Tiers, birthdays and campaigns",
  keys: [["tier", "Member tier ({tier})"], ["nextTier", "Next tier ({n}, {tier})"], ["tierOnly", "Reward for some tiers ({tiers})"], ["birthdayWay", "Birthday (ways to earn)"], ["birthdayAsk", "Add your birthday"], ["birthdaySave", "Save the birthday"], ["birthdayDone", "Birthday saved"], ["followWay", "Follow ({network})"], ["follow", "Follow button"], ["campaign", "Bonus campaign ({x}, {date})"]],
};

/** Every widget word with its name: the groups, the other words, then any new word by its key. */
export function allTextGroups(): { title: string; keys: [TextKey, string][] }[] {
  const named = new Set([...TEXT_GROUPS, OTHER_TEXTS].flatMap((g) => g.keys.map(([k]) => k)));
  const rest = (Object.keys(WIDGET_TEXTS) as TextKey[]).filter((k) => !named.has(k));
  return [...TEXT_GROUPS, OTHER_TEXTS, ...(rest.length ? [{ title: "More words", keys: rest.map((k) => [k, WIDGET_TEXTS[k]] as [TextKey, string]) }] : [])];
}
