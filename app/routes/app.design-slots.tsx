/**
 * Which designs a section has (Design 1…5) and their names, for the switcher on design pages.
 * GET ?base=faq → { slots: [1, 2], names: { "1": "Home", "2": "Landing page" } }
 * POST intent=rename (base, slot, name) | intent=delete (base, slot; not design 1).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { errorMessage, gql, type AdminClient } from "../lib/admin.server";
import { remove, upsert } from "../lib/cro.server";
import { MAX_DESIGNS } from "../lib/design-slot.server";

const BASE = /^[a-z_]{2,40}$/;
type Names = Record<string, Record<string, string>>;

async function handles(admin: AdminClient): Promise<{ id: string; handle: string }[]> {
  const data = await gql(admin, `#graphql
    query CroDesignHandles { metaobjects(type: "$app:cro_design", first: 250) { nodes { id handle } } }`);
  return data.metaobjects?.nodes ?? [];
}

async function readNames(admin: AdminClient): Promise<Names> {
  const data = await gql(admin, `#graphql
    query CroDesignNames { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "design_names" }) { field(key: "config") { value } } }`);
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const base = new URL(request.url).searchParams.get("base") ?? "";
  if (!BASE.test(base)) return { slots: [1], names: {} as Record<string, string> };
  const [list, names] = await Promise.all([handles(admin), readNames(admin)]);
  const have = new Set(list.map((m) => m.handle));
  const slots = [1];
  for (let n = 2; n <= MAX_DESIGNS; n++) if (have.has(`${base}_${n}`) || have.has(`${base}_${n}_editor`)) slots.push(n);
  return { slots, names: names[base] ?? {} };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const base = String(form.get("base") ?? "");
  const slot = Number(form.get("slot"));
  if (!BASE.test(base) || !(slot >= 1 && slot <= MAX_DESIGNS)) return { ok: false, error: "Unknown design." };
  try {
    const names = await readNames(admin);
    if (form.get("intent") === "delete") {
      if (slot === 1) return { ok: false, error: "Design 1 can't be deleted." };
      const own = new Set([`${base}_${slot}`, `${base}_${slot}_draft`, `${base}_${slot}_editor`]);
      for (const m of await handles(admin)) if (own.has(m.handle)) await remove(admin, m.id);
      if (names[base]) delete names[base][String(slot)];
    } else {
      const name = String(form.get("name") ?? "").trim().slice(0, 40);
      names[base] = { ...names[base], [String(slot)]: name };
      if (!name) delete names[base][String(slot)];
    }
    await upsert(admin, "$app:cro_design", "design_names", { config: JSON.stringify(names) });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
};
