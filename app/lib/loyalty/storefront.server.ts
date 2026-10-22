/**
 * The storefront copy of the loyalty program ($app:cro_design "loyalty"), read by the Conversion boosters
 * embed (ucs-boosters.liquid) and ucs-loyalty.js: the program's rules, rewards, widget look and words, never
 * any member's data. Saved again whenever the program or its settings change.
 */
import { upsert } from "../cro.server";
import type { AdminClient } from "../admin.server";
import { toStorefrontLoyalty } from "./config";
import { getProgram } from "./program.server";

export async function publishLoyalty(admin: AdminClient, shop: string) {
  const p = await getProgram(shop);
  await upsert(admin, "$app:cro_design", "loyalty", { config: JSON.stringify(toStorefrontLoyalty(p.config, p.on)) });
}
