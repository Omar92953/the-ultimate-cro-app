/**
 * The six bundle recipes (app/lib/bundle-recipes.ts) as website copy: how each is priced, where it
 * shows, how to set it up and its questions. Used by the bundles hub (/bundles/) and the page of each
 * recipe (/bundles/<recipe>/). Facts come from the help guide (src/content/help/bundles.md) and the
 * app's editors; prices in examples are made up for the demo store.
 */
import { BUNDLE_RECIPES, plain, type RecipeKey } from "./app";
import type { PageMeta } from "./pages";
import type { QA } from "../components/Faq.astro";

export const recipeSlug = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
export const recipePath = (k: RecipeKey) => `/bundles/${recipeSlug(k)}/`;

export type RecipeCopy = {
  /** How it's priced, in plain words. */
  price: string;
  /** Where shoppers see it. */
  where: string;
  /** Setup in the app, in order. */
  steps: string[];
  /** What happens in the cart and at checkout. */
  checkout: string;
  /** An example bundle from the demo store. */
  example: string;
  faq: QA[];
};

const SPLIT = "At checkout the bundle is split into the items the shopper picked, so each item's stock goes down and the items appear on the order. In the cart the picks show as one bundle line at the bundle price.";

export const RECIPE_COPY: Record<RecipeKey, RecipeCopy> = {
  fbt: {
    price: "A percentage off when all the items are bought together.",
    where: "On each item's product page, with Buy all.",
    steps: [
      "Turn on the Conversion boosters app embed (Online Store → Themes → Customize → App embeds). The box is shown by this embed, so there is no block to place.",
      "In the app open Bundles → Create bundle offer and choose Frequently bought together.",
      "Under Items, pick two or three products and how many of each.",
      "Under Discount, set the percentage off the set.",
      "Under Box look, choose pictures in a row or a list, the heading, the button text and how the saving shows. The look is shared by every box on your store.",
    ],
    checkout: "Shopify applies the discount at checkout when all the items of the set are in the cart, even if the shopper added them one by one.",
    example: "Evening ritual set: Cedar Candle, Clay Mug and Oat Soap, 15% off together.",
    faq: [
      { q: "Can one product be in two sets?", a: "Yes. Keep the sets clearly different so the product page doesn't feel crowded." },
      { q: "Do shoppers have to add everything at once?", a: "No. The discount applies at checkout when the whole set is in the cart, however the items were added." },
    ],
  },
  kit: {
    price: "Its own price; Shopify takes each item from stock.",
    where: "Its own product page, one line in the cart.",
    steps: [
      "In the app open Bundles → Create bundle offer and choose Fixed bundle.",
      "Under Items, pick the products in the kit and how many of each.",
      "Under Price, set the kit's price.",
      "The app creates the product with Shopify's own bundles, with a picture and a What's inside list. Check the product page preview and save.",
    ],
    checkout: "The kit is one product and one cart line. Shopify tracks its stock from its items, so selling a kit takes each item from stock.",
    example: "Calm Night Kit: a candle, a cream and a soap in one box, $62 instead of $74.",
    faq: [
      { q: "Does the kit need its own stock?", a: "No. Shopify works out the kit's stock from its items." },
      { q: "Can shoppers change what's in the kit?", a: "No, a fixed bundle always has the same items. For a box the shopper fills, use Mix and match." },
    ],
  },
  mixmatch: {
    price: "One price for the box, a percentage off the picks, or tiers.",
    where: "The box's product page, or its own store page made by the app.",
    steps: [
      "In the app open Bundles → Create bundle offer and choose Mix and match.",
      "Let the app create and publish the bundle product, or pick one you have. For a store page it also creates the page.",
      "Add steps, for example \"Pick 3 candles\" (min 3, max 3). A step can use a whole collection.",
      "Choose the price: one price, a percentage off the picks, or tiers.",
      "Click Add to theme in the editor's \"Get it on your store\" card once; it ticks itself.",
    ],
    checkout: SPLIT,
    example: "Candle box: any 3 candles from the candles collection for $56.",
    faq: [
      { q: "Can a step be optional?", a: "Yes. Mark a step such as \"Add a frame\" as optional, and shoppers can skip it." },
      { q: "Do I have to create the bundle product myself?", a: "No. The app can create and publish it for you, and the store page if you choose one." },
    ],
  },
  browse: {
    price: "The bundle's price once every step is filled.",
    where: "Collection pages (+ Add to bundle on every product card), product pages, and a tray that follows the shopper.",
    steps: [
      "In the app open Bundles → Create bundle offer and choose Build your own bundle.",
      "Add the steps and the collection each step uses.",
      "Turn on the Bundle tray app embed. Adding the Add to bundle block to product pages is optional (the Bundles page has both links).",
      "Open a collection page on your store and check that every product card has + Add to bundle.",
    ],
    checkout: `The tray shows each step's progress and, once complete, Add bundle to cart or Checkout. ${SPLIT}`,
    example: "A gift tote, built while browsing the collections.",
    faq: [
      { q: "Does the tray stay when shoppers change pages?", a: "Yes. It follows them across product and collection pages with each step's progress." },
      { q: "Is this good for big catalogues?", a: "Yes: shoppers add items from the collection pages they already browse, instead of one long builder." },
    ],
  },
  growing: {
    price: "More off for each extra item: by percent, by amount or a set price.",
    where: "A product page, or its own store page made by the app.",
    steps: [
      "In the app open Bundles → Create bundle offer and choose Tiered bundle.",
      "Pick the collection or products shoppers choose from.",
      "Add the tiers, for example 2 items 10% off and 3 items 15% off.",
      "Choose a product page or let the app make the bundle's own store page, then Add to theme once.",
    ],
    checkout: SPLIT,
    example: "Build your skin set: 2 items 10% off, 3 items 15%, 4 items 20%.",
    faq: [
      { q: "Do shoppers see the next tier?", a: "Yes. The builder shows a line such as \"Add 1 more to save 15%\"." },
      { q: "How is this different from quantity breaks?", a: "Quantity breaks are more of one product. A tiered bundle mixes different products and grows the discount with the count." },
    ],
  },
  anyN: {
    price: "A set price for N items, such as any 3 for $30 or any 6 for $55.",
    where: "A product page; long collections get Show more and a search box.",
    steps: [
      "In the app open Bundles → Create bundle offer and choose Fixed price bundle.",
      "Pick the collection shoppers choose from.",
      "Add the price tiers, for example 3 for $30 and 6 for $55.",
      "Add to theme once on the bundle's product page.",
    ],
    checkout: SPLIT,
    example: "Sock drawer: any 3 pairs for $30, any 6 for $55, from a long collection.",
    faq: [
      { q: "Does it work with a long collection?", a: "Yes. Long collections get Show more and a search box in the builder." },
      { q: "Can I offer more than one tier?", a: "Yes, for example any 3 for $30 and any 6 for $55." },
    ],
  },
};

export const recipeMeta = (k: RecipeKey): PageMeta => {
  const r = BUNDLE_RECIPES.find((x) => x.key === k)!;
  const title = plain(r.title);
  const short = plain(r.short);
  return {
    slug: `recipe-${recipeSlug(k)}`,
    path: recipePath(k),
    // "Fixed bundle on Shopify", "Mix and match bundles on Shopify", "Frequently bought together on Shopify".
    title: `${/bundle|together/i.test(short) ? short : `${short} bundles`} on Shopify: setup, price and checkout`,
    description: `${title}: ${plain(r.about)} How to set it up in CRO Toolbox, how it's priced and what happens at checkout.`.slice(0, 200),
    ogTitle: title,
    ogKicker: "Bundles",
  };
};
export const RECIPE_META: PageMeta[] = BUNDLE_RECIPES.map((r) => recipeMeta(r.key));
