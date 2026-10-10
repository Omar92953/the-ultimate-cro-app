/**
 * Admin API side of hero banners ($app:cro_hero): list, read, save (live or theme-editor draft),
 * duplicate, delete, reorder. Keeps $app:cro_design "hero_default" pointing at the first banner, which
 * "Hero image" sections show when no banner is picked.
 */
import { gql, type AdminClient } from "./admin.server";
import { remove, slug, upsert } from "./cro.server";
import { toStorefrontHero, withHeroDefaults, type HeroDesign } from "./hero-design";

const TYPE = "$app:cro_hero";

/** live: false until saved once (a "See it on my store" preview of a new banner). */
export type HeroItem = { id: string; handle: string; position: number; live: boolean; config: HeroDesign };

const FIELDS = `id handle position: field(key: "position") { value } editor: field(key: "editor") { value } live: field(key: "config") { value }`;

function toItem(node: { id: string; handle: string; position?: { value: string } | null; editor?: { value: string } | null; live?: { value: string } | null }): HeroItem {
  let raw: unknown = null;
  try {
    raw = JSON.parse(node.editor?.value ?? "null");
  } catch {
    raw = null;
  }
  return { id: node.id, handle: node.handle, position: Number(node.position?.value) || 0, live: !!node.live?.value, config: withHeroDefaults(raw) };
}

export async function listHeroes(admin: AdminClient): Promise<HeroItem[]> {
  const data = await gql(admin, `#graphql\n query CroHeroes { metaobjects(type: "${TYPE}", first: 50) { nodes { ${FIELDS} } } }`);
  return (data.metaobjects?.nodes ?? []).map(toItem).sort((a: HeroItem, b: HeroItem) => a.position - b.position || a.handle.localeCompare(b.handle));
}

export async function getHero(admin: AdminClient, handle: string): Promise<HeroItem | null> {
  const data = await gql(admin, `#graphql\n query CroHero($h: String!) { metaobjectByHandle(handle: { type: "${TYPE}", handle: $h }) { ${FIELDS} } }`, { h: handle });
  return data.metaobjectByHandle ? toItem(data.metaobjectByHandle) : null;
}

/** Points "hero_default" at the first banner (or nothing). */
async function syncDefault(admin: AdminClient, items?: HeroItem[]) {
  const list = items ?? (await listHeroes(admin));
  await upsert(admin, "$app:cro_design", "hero_default", { config: JSON.stringify({ h: list[0]?.handle ?? "" }) });
}

/**
 * Saves a banner; a new one (handle null) goes last. With draftOnly only the theme-editor preview
 * changes (its own copy of the settings and images); a banner that doesn't exist yet is created
 * hidden (no live settings) so the preview has something to show.
 */
export async function saveHero(admin: AdminClient, handle: string | null, config: HeroDesign, draftOnly = false) {
  const clean = withHeroDefaults(config);
  const live = JSON.stringify(toStorefrontHero(clean));
  const existing = handle ? await getHero(admin, handle) : null;
  const h = existing?.handle ?? handle ?? slug("hero");
  const images = { desktop: clean.images.desktop?.id ?? "", mobile: clean.images.mobile?.id ?? "" };
  const fields: Record<string, string> = { draft: live, draft_desktop: images.desktop, draft_mobile: images.mobile };
  if (!draftOnly || !existing) Object.assign(fields, { name: clean.name, editor: JSON.stringify(clean) });
  if (!draftOnly) Object.assign(fields, { config: live, image_desktop: images.desktop, image_mobile: images.mobile });
  if (!existing) fields.position = String((await listHeroes(admin)).reduce((m, i) => Math.max(m, i.position), 0) + 1);
  await upsert(admin, TYPE, h, fields);
  if (!existing) await syncDefault(admin);
  return { handle: h, config: clean };
}

export async function duplicateHero(admin: AdminClient, handle: string) {
  const item = await getHero(admin, handle);
  if (!item) throw new Error("Banner not found");
  return saveHero(admin, null, { ...item.config, name: `${item.config.name} (copy)`.slice(0, 80) });
}

export async function deleteHero(admin: AdminClient, handle: string) {
  const item = await getHero(admin, handle);
  if (item) await remove(admin, item.id);
  await syncDefault(admin);
}

/** Saves a new order (banner handles, first to last); the first banner is the default. */
export async function reorderHeroes(admin: AdminClient, handles: string[]) {
  const items = await listHeroes(admin);
  const byHandle = new Map(items.map((it) => [it.handle, it]));
  const ordered = [...handles.flatMap((h) => byHandle.get(h) ?? []), ...items.filter((it) => !handles.includes(it.handle))];
  await Promise.all(ordered.map((it, i) => (it.position === i + 1 ? null : upsert(admin, TYPE, it.handle, { position: String(i + 1) }))));
  await syncDefault(admin, ordered);
}
