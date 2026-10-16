/**
 * Add-ons and Personalization keep their items and settings (Content) in the Add-ons / Personalization
 * tab, and their look in the group's Style tab. Each style (1 to 5) is one stored design that holds both,
 * so when the items are saved they are copied into every other style that exists, keeping each one's look.
 */
import type { AdminClient } from "./admin.server";
import type { AddonsConfig } from "./addons";
import type { PersonalizeDesign } from "./personalize-design";
import { getAddons, getPersonalizeDesign, saveAddons, savePersonalizeDesign } from "./designs.server";
import { inSlot } from "./design-slot.server";
import { existingSlots } from "./offer-style.server";

export async function shareAddonsContent(admin: AdminClient, c: AddonsConfig) {
  for (const n of await existingSlots(admin, "addons")) {
    await inSlot(["addons"], n, async () => {
      const cur = (await getAddons(admin)).config;
      await saveAddons(admin, { ...cur, heading: c.heading, items: c.items, message: c.message, where: c.where });
    });
  }
}

export async function sharePersonalizeContent(admin: AdminClient, c: PersonalizeDesign) {
  for (const n of await existingSlots(admin, "personalize")) {
    await inSlot(["personalize"], n, async () => {
      const cur = (await getPersonalizeDesign(admin)).config;
      await savePersonalizeDesign(admin, { ...cur, heading: c.heading, fields: c.fields, fee: c.fee, where: c.where });
    });
  }
}
