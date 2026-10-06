/**
 * Bundle deals, Admin API side: save, delete and reorder $app:cro_deal metaobjects. Every change
 * re-syncs the discount Function config and the storefront copy (syncDiscounts), so what shoppers
 * see and what checkout charges always come from the same save.
 */
import { AdminError, type AdminClient } from "./admin.server";
import { listDeals, remove, slug, syncDiscounts, upsert } from "./cro.server";
import { validateDeal, type Deal } from "./deals";

export { listDeals };

export async function saveDeal(admin: AdminClient, deal: Deal) {
  const problems = validateDeal(deal);
  if (problems.length) throw new AdminError(problems.join(" "));
  let position = deal.position;
  if (!deal.id) position = (await listDeals(admin)).reduce((max, d) => Math.max(max, d.position), 0) + 1;
  const saved = await upsert(admin, "$app:cro_deal", deal.handle || slug(`deal-${deal.kind}`), {
    name: deal.name.trim(),
    kind: deal.kind,
    active: deal.active ? "true" : "false",
    position: String(position),
    config: JSON.stringify(deal.config),
  });
  await syncDiscounts(admin);
  return saved;
}

export async function deleteDeal(admin: AdminClient, id: string) {
  await remove(admin, id);
  await syncDiscounts(admin);
}

export async function setDealActive(admin: AdminClient, deal: Deal, active: boolean) {
  await saveDeal(admin, { ...deal, active });
}
