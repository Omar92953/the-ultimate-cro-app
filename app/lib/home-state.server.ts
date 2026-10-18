/**
 * Small per-shop Home choices, kept in the shop's own store ($app:cro_design "home_state"):
 * the setup guide was hidden, and the guide steps the merchant ticked by hand ("Mark as done").
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";

export type HomeState = { dismissed: boolean; manual: string[] };
const EMPTY: HomeState = { dismissed: false, manual: [] };

export async function getHomeState(admin: AdminClient): Promise<HomeState> {
  const data = await gql(admin, `#graphql
    query CroHomeState { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "home_state" }) { field(key: "config") { value } } }`);
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    if (!v) return EMPTY;
    return { dismissed: v.dismissed === true, manual: Array.isArray(v.manual) ? v.manual.filter((s: unknown) => typeof s === "string").slice(0, 20) : [] };
  } catch {
    return EMPTY;
  }
}

export async function setHomeState(admin: AdminClient, patch: Partial<HomeState>) {
  const next = { ...(await getHomeState(admin)), ...patch };
  await upsert(admin, "$app:cro_design", "home_state", { config: JSON.stringify(next) });
  return next;
}
