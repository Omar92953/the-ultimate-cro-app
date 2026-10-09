/**
 * Pages, Admin API side: each page design is one $app:cro_page metaobject (handle = page type)
 * whose "config" field holds the storefront-ready JSON (settings + CSS variables + links).
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { toStorefrontContact, withContactDefaults, type ContactConfig } from "./pages";

async function getPage(admin: AdminClient, handle: string): Promise<unknown> {
  const data = await gql(
    admin,
    `#graphql
    query CroPage($handle: String!) {
      metaobjectByHandle(handle: { type: "$app:cro_page", handle: $handle }) { field(key: "config") { value } }
    }`,
    { handle },
  );
  try {
    return JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
  } catch {
    return null;
  }
}

export async function getContact(admin: AdminClient): Promise<{ config: ContactConfig; saved: boolean }> {
  const raw = await getPage(admin, "contact");
  return { config: withContactDefaults(raw), saved: raw !== null };
}

export async function saveContact(admin: AdminClient, config: ContactConfig, draftOnly = false) {
  const clean = withContactDefaults(config);
  if (!draftOnly) await upsert(admin, "$app:cro_page", "contact", { config: JSON.stringify(toStorefrontContact(clean)) });
  await upsert(admin, "$app:cro_page", "contact_draft", { config: JSON.stringify(toStorefrontContact(clean)) });
  return clean;
}
