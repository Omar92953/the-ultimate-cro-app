/**
 * Section designs, Admin API side: one $app:cro_design metaobject per section (handle = section key)
 * whose "config" field holds the storefront-ready JSON.
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { toStorefrontCountdownBar, withCountdownBarDefaults, type CountdownBarConfig } from "./designs";

async function getDesign(admin: AdminClient, handle: string): Promise<unknown> {
  const data = await gql(
    admin,
    `#graphql
    query CroDesign($handle: String!) {
      metaobjectByHandle(handle: { type: "$app:cro_design", handle: $handle }) { field(key: "config") { value } }
    }`,
    { handle },
  );
  try {
    return JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
  } catch {
    return null;
  }
}

export async function getCountdownBar(admin: AdminClient): Promise<{ config: CountdownBarConfig; saved: boolean }> {
  const raw = await getDesign(admin, "countdown_bar");
  return { config: withCountdownBarDefaults(raw), saved: raw !== null };
}

export async function saveCountdownBar(admin: AdminClient, config: CountdownBarConfig) {
  const clean = withCountdownBarDefaults(config);
  await upsert(admin, "$app:cro_design", "countdown_bar", { config: JSON.stringify(toStorefrontCountdownBar(clean)) });
  return clean;
}
