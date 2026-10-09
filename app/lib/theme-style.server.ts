/**
 * Reads the live (main) theme's style from config/settings_data.json and settings_schema.json:
 * colour schemes (Online Store 2.0) or the older colour settings, fonts and corner radii. Read only.
 */
import { gql, type AdminClient } from "./admin.server";
import { FALLBACK_STYLE, parseFont, type ThemeScheme, type ThemeStyle } from "./theme-style";

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- theme JSON

const parse = (text: string | undefined): Obj | null => {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, ""));
  } catch {
    return null;
  }
};
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim().slice(0, 7) : fallback);
const humanize = (id: string) => id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function getThemeStyle(admin: AdminClient): Promise<ThemeStyle> {
  const data = await gql(
    admin,
    `#graphql
    query CroThemeStyle {
      themes(first: 1, roles: [MAIN]) {
        nodes {
          name
          files(filenames: ["config/settings_data.json", "config/settings_schema.json"]) {
            nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
          }
        }
      }
    }`,
  );
  const theme = data.themes?.nodes?.[0];
  if (!theme) return FALLBACK_STYLE;
  const files: Record<string, string> = {};
  for (const f of theme.files?.nodes ?? []) files[f.filename] = f.body?.content ?? "";
  const sd = parse(files["config/settings_data.json"]) ?? {};
  const schema = (parse(files["config/settings_schema.json"]) as Obj[] | null) ?? [];

  const presets: Obj = sd.presets ?? {};
  const current: Obj = typeof sd.current === "string" ? (presets[sd.current] ?? {}) : (sd.current ?? {});
  const firstPreset: Obj = (Object.values(presets)[0] as Obj) ?? {};
  const settings: Obj[] = schema.flatMap((g) => (Array.isArray(g?.settings) ? g.settings : []));
  const defaults: Obj = Object.fromEntries(settings.filter((s) => s.id).map((s) => [s.id, s.default]));
  const get = (key: string) => current[key] ?? firstPreset[key] ?? defaults[key];
  const num = (key: string, fallback: number) => {
    const n = Number(get(key));
    return Number.isFinite(n) ? n : fallback;
  };

  // Online Store 2.0 colour schemes; "role" says which colour is the background, text, button…
  const group = settings.find((s) => s.type === "color_scheme_group");
  let schemes: ThemeScheme[] = [];
  let kind: ThemeStyle["kind"] = "schemes";
  if (group) {
    const role: Obj = group.role ?? {};
    const key = (r: unknown, fallback: string) => (typeof r === "string" ? r : r && typeof r === "object" && typeof (r as Obj).solid === "string" ? (r as Obj).solid : fallback);
    const raw: Obj = get(group.id) ?? {};
    schemes = Object.entries(raw).map(([id, sc]) => {
      const st: Obj = (sc as Obj)?.settings ?? {};
      const bg = hex(st[key(role.background, "background")], "#ffffff");
      const text = hex(st[key(role.text, "text")], "#121212");
      return {
        id,
        name: humanize(id),
        bg,
        text,
        button: hex(st[key(role.primary_button, "button")], text),
        buttonText: hex(st[key(role.on_primary_button, "button_label")], bg),
        link: hex(st[key(role.links, "secondary_button_label")], text),
      };
    });
  } else if (get("colors_background_1") || get("colors_text")) {
    // Older Dawn-style themes: fixed colour classes built from five colours.
    kind = "legacy";
    const b1 = hex(get("colors_background_1"), "#ffffff");
    const b2 = hex(get("colors_background_2"), "#f3f3f3");
    const tx = hex(get("colors_text"), "#121212");
    const a1 = hex(get("colors_accent_1"), "#121212");
    const a2 = hex(get("colors_accent_2"), "#334fb4");
    const sol = hex(get("colors_solid_button_labels"), "#ffffff");
    schemes = [
      { id: "background-1", name: "Background 1", bg: b1, text: tx, button: a1, buttonText: sol, link: tx },
      { id: "background-2", name: "Background 2", bg: b2, text: tx, button: a1, buttonText: sol, link: tx },
      { id: "inverse", name: "Inverse", bg: tx, text: b1, button: b1, buttonText: tx, link: b1 },
      { id: "accent-1", name: "Accent 1", bg: a1, text: sol, button: sol, buttonText: a1, link: sol },
      { id: "accent-2", name: "Accent 2", bg: a2, text: sol, button: sol, buttonText: a2, link: sol },
    ];
  }
  if (!schemes.length) schemes = FALLBACK_STYLE.schemes;

  return {
    theme: String(theme.name ?? ""),
    kind,
    schemes,
    fonts: { heading: parseFont(get("type_header_font"), 600), body: parseFont(get("type_body_font"), 400) },
    radius: {
      button: num("buttons_radius", FALLBACK_STYLE.radius.button),
      card: num("product_card_corner_radius", num("card_corner_radius", FALLBACK_STYLE.radius.card)),
      input: num("inputs_radius", FALLBACK_STYLE.radius.input),
      media: num("media_radius", FALLBACK_STYLE.radius.media),
      pill: num("variant_pills_radius", FALLBACK_STYLE.radius.pill),
    },
    buttonBorder: num("buttons_border_thickness", FALLBACK_STYLE.buttonBorder),
  };
}
