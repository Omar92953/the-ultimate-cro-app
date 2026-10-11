/**
 * Small per-shop Home choices, kept in the shop's own store ($app:cro_design "home_state"):
 * the setup guide was dismissed, the plans were looked at.
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";

export type HomeState = { dismissed: boolean; planSeen: boolean };
const EMPTY: HomeState = { dismissed: false, planSeen: false };

export async function getHomeState(admin: AdminClient): Promise<HomeState> {
  const data = await gql(admin, `#graphql
    query CroHomeState { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "home_state" }) { field(key: "config") { value } } }`);
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    return v ? { dismissed: v.dismissed === true, planSeen: v.planSeen === true } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function setHomeState(admin: AdminClient, patch: Partial<HomeState>) {
  const next = { ...(await getHomeState(admin)), ...patch };
  await upsert(admin, "$app:cro_design", "home_state", { config: JSON.stringify(next) });
  return next;
}
