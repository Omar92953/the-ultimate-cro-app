/* eslint-disable @typescript-eslint/no-explicit-any -- raw Admin API JSON; operations are schema-checked by `npm run graphql-codegen` */
/**
 * Admin API side of the store-section lists (reviews, FAQ, logos, announcements): read, save,
 * reorder, show/hide and delete the app-owned metaobjects, plus file picking and uploads.
 */
import { gql, AdminError, type AdminClient } from "./admin.server";
import { remove, slug, upsert } from "./cro.server";
import {
  SECTIONS,
  dateTimeToDay,
  dayToDateTime,
  normalizeLink,
  normalizeUrl,
  parseOffset,
  type MediaRef,
  type ProductRef,
  type SectionItem,
  type SectionKind,
  type Value,
} from "./sections";

const ITEMS_QUERY = `#graphql
  query CroSectionItems($type: String!, $first: Int!) {
    metaobjects(type: $type, first: $first) {
      nodes {
        id
        handle
        fields {
          key
          value
          reference {
            __typename
            ... on MediaImage { id alt preview { image { url } } }
            ... on Video { id alt preview { image { url } } }
            ... on Product { id title featuredMedia { preview { image { url } } } }
          }
        }
      }
    }
  }
`;

function toValue(type: string, field: { value: string | null; reference?: any } | undefined): Value {
  const raw = field?.value ?? null;
  const ref = field?.reference;
  switch (type) {
    case "bool":
      return raw === "true";
    case "rating":
      return Number(raw) || 0;
    case "media":
    case "image":
      if (!ref?.id) return null;
      return {
        id: ref.id,
        url: ref.preview?.image?.url ?? null,
        kind: ref.__typename === "Video" ? "video" : "image",
        title: ref.alt || (ref.__typename === "Video" ? "Video" : "Image"),
      } satisfies MediaRef;
    case "product":
      if (!ref?.id) return null;
      return { id: ref.id, title: ref.title ?? "", image: ref.featuredMedia?.preview?.image?.url ?? null } satisfies ProductRef;
    default:
      return raw ?? "";
  }
}

export async function listItems(admin: AdminClient, kind: SectionKind): Promise<SectionItem[]> {
  const cfg = SECTIONS[kind];
  const data = await gql(admin, ITEMS_QUERY, { type: cfg.type, first: cfg.limit });
  const items: SectionItem[] = data.metaobjects.nodes.map((node: any) => {
    const byKey: Record<string, any> = Object.fromEntries(node.fields.map((f: any) => [f.key, f]));
    const values: Record<string, Value> = {};
    for (const f of cfg.fields) {
      // A switch that was never saved counts as on (the storefront treats it the same way).
      values[f.key] = f.type === "bool" && byKey[f.key]?.value == null ? (f.default ?? true) : toValue(f.type, byKey[f.key]);
    }
    return { id: node.id, handle: node.handle, position: Number(byKey.position?.value) || 0, values };
  });
  return items.sort((a, b) => a.position - b.position || String(a.handle).localeCompare(String(b.handle)));
}

export async function getItem(admin: AdminClient, kind: SectionKind, id: string) {
  const items = await listItems(admin, kind);
  return { item: items.find((i) => i.id === id) ?? null, nextPosition: nextPosition(items) };
}

function nextPosition(items: SectionItem[]) {
  return items.reduce((max, i) => Math.max(max, i.position), 0) + 1;
}

export async function shopOffset(admin: AdminClient) {
  const data = await gql(admin, `#graphql
    query CroShopOffset { shop { timezoneOffset } }`);
  return parseOffset(data.shop?.timezoneOffset);
}

/** Stored date-times → days in the shop's time zone, for the form. */
export function toForm(kind: SectionKind, item: SectionItem, offsetMinutes: number): SectionItem {
  const values = { ...item.values };
  for (const f of SECTIONS[kind].fields) {
    if (f.type === "datetime" && values[f.key]) values[f.key] = dateTimeToDay(String(values[f.key]), offsetMinutes);
  }
  return { ...item, values };
}

/** Checks the form and turns it into metaobject field strings. Throws a readable error. */
export function serialize(kind: SectionKind, item: SectionItem, offsetIso: string): Record<string, string> {
  const cfg = SECTIONS[kind];
  const out: Record<string, string> = {};
  for (const f of cfg.fields) {
    const v = item.values[f.key];
    let s = "";
    switch (f.type) {
      case "bool":
        s = v === true ? "true" : "false";
        break;
      case "rating": {
        const n = Math.round(Number(v) || 0);
        if (n < 0 || n > 5) throw new AdminError(`${f.label}: choose 1 to 5 stars.`);
        s = n ? String(n) : "";
        break;
      }
      case "media":
      case "image":
      case "product":
        s = v && typeof v === "object" && "id" in v ? v.id : "";
        break;
      case "url":
        s = normalizeUrl(String(v ?? ""));
        break;
      case "link":
        s = normalizeLink(String(v ?? ""));
        break;
      case "date":
        s = /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : "";
        break;
      case "datetime":
        s = dayToDateTime(String(v ?? ""), offsetIso, f.edge);
        break;
      default:
        s = String(v ?? "").trim();
    }
    if (f.required && !s) throw new AdminError(`${f.label} is required.`);
    if (f.type === "text" && s.length > 255) throw new AdminError(`${f.label} is too long (255 characters at most).`);
    out[f.key] = s;
  }
  if (out.starts_at && out.ends_at && Date.parse(out.ends_at) < Date.parse(out.starts_at)) {
    throw new AdminError("“Show until” must be after “Show from”.");
  }
  out.position = String(Math.max(0, Math.round(item.position || 0)));
  return out;
}

export async function saveItem(admin: AdminClient, kind: SectionKind, item: SectionItem) {
  const cfg = SECTIONS[kind];
  const { iso } = await shopOffset(admin);
  let position = item.position;
  if (!item.id) {
    const items = await listItems(admin, kind);
    if (items.length >= cfg.limit) throw new AdminError(`You can have up to ${cfg.limit} ${cfg.plural}.`);
    position = nextPosition(items);
  }
  const fields = serialize(kind, { ...item, position }, iso);
  const saved = await upsert(admin, cfg.type, item.handle || slug(cfg.singular), fields);
  await syncList(admin, kind);
  return saved;
}

/** Rewrites the ordered list of shown items that the theme reads ($app:cro_lists "main"). */
export async function syncList(admin: AdminClient, kind: SectionKind) {
  const cfg = SECTIONS[kind];
  const shown = (await listItems(admin, kind)).filter((i) => !cfg.activeKey || i.values[cfg.activeKey] !== false);
  await upsert(admin, "$app:cro_lists", "main", { [kind]: JSON.stringify(shown.map((i) => i.id)) });
}

export async function deleteItem(admin: AdminClient, kind: SectionKind, id: string) {
  await remove(admin, id);
  await syncList(admin, kind);
}

async function updateFields(admin: AdminClient, updates: { id: string; fields: Record<string, string> }[]) {
  // One request for the lot: aliased metaobjectUpdate calls (ids are Shopify GIDs, safe to inline).
  for (let i = 0; i < updates.length; i += 25) {
    const chunk = updates.slice(i, i + 25);
    const body = chunk
      .map(
        (u, j) =>
          `m${j}: metaobjectUpdate(id: ${JSON.stringify(u.id)}, metaobject: { fields: ${JSON.stringify(
            Object.entries(u.fields).map(([key, value]) => ({ key, value })),
          ).replace(/"(key|value)":/g, "$1:")} }) { userErrors { field message } }`,
      )
      .join("\n");
    if (body) await gql(admin, `mutation CroSectionUpdates {\n${body}\n}`);
  }
}

/** Saves the order shown in the list (1, 2, 3…). */
export async function reorder(admin: AdminClient, kind: SectionKind, ids: string[]) {
  await updateFields(admin, ids.map((id, i) => ({ id, fields: { position: String(i + 1) } })));
  await syncList(admin, kind);
}

export async function setShown(admin: AdminClient, kind: SectionKind, id: string, shown: boolean) {
  const key = SECTIONS[kind].activeKey;
  if (!key) throw new AdminError("This list has no show/hide switch.");
  await updateFields(admin, [{ id, fields: { [key]: shown ? "true" : "false" } }]);
  await syncList(admin, kind);
}

/* ------------------------------------------------------------------ files -- */
export type FileOption = MediaRef & { ready: boolean };

export async function listFiles(admin: AdminClient, accept: "image" | "media"): Promise<FileOption[]> {
  const data = await gql(
    admin,
    `#graphql
    query CroSectionFiles($query: String!) {
      files(first: 40, query: $query, sortKey: CREATED_AT, reverse: true) {
        nodes {
          __typename
          ... on MediaImage { id alt fileStatus preview { image { url } } }
          ... on Video { id alt filename fileStatus preview { image { url } } }
        }
      }
    }`,
    { query: accept === "image" ? "media_type:IMAGE" : "media_type:IMAGE OR media_type:VIDEO" },
  );
  return data.files.nodes
    .filter((n: any) => n?.id)
    .map((n: any) => ({
      id: n.id,
      url: n.preview?.image?.url ?? null,
      kind: n.__typename === "Video" ? "video" : "image",
      title: n.alt || n.filename || (n.__typename === "Video" ? "Video" : "Image"),
      ready: n.fileStatus === "READY",
    }));
}

const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_VIDEO = 250 * 1024 * 1024;

/** Step 1 of an upload: a one-time address the browser sends the file to. */
export async function startUpload(admin: AdminClient, file: { filename: string; mimeType: string; fileSize: number }) {
  const video = file.mimeType.startsWith("video/");
  if (!video && !file.mimeType.startsWith("image/")) throw new AdminError("Choose an image or a video file.");
  if (file.fileSize > (video ? MAX_VIDEO : MAX_IMAGE)) {
    throw new AdminError(video ? "Videos can be up to 250 MB." : "Images can be up to 20 MB.");
  }
  const data = await gql(
    admin,
    `#graphql
    mutation CroStagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          filename: file.filename,
          mimeType: file.mimeType,
          resource: video ? "VIDEO" : "IMAGE",
          fileSize: String(file.fileSize),
          httpMethod: "POST",
        },
      ],
    },
  );
  const target = data.stagedUploadsCreate.stagedTargets[0];
  return { url: target.url as string, resourceUrl: target.resourceUrl as string, parameters: target.parameters as { name: string; value: string }[], video };
}

/** Step 2: tell Shopify the upload is done; it appears in Content → Files. */
export async function finishUpload(admin: AdminClient, input: { resourceUrl: string; video: boolean; alt: string }): Promise<FileOption> {
  const data = await gql(
    admin,
    `#graphql
    mutation CroFileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { __typename id alt fileStatus preview { image { url } } }
        userErrors { field message }
      }
    }`,
    { files: [{ originalSource: input.resourceUrl, contentType: input.video ? "VIDEO" : "IMAGE", alt: input.alt.slice(0, 500) }] },
  );
  const f = data.fileCreate.files[0];
  return {
    id: f.id,
    url: f.preview?.image?.url ?? null,
    kind: input.video ? "video" : "image",
    title: f.alt || (input.video ? "Video" : "Image"),
    ready: f.fileStatus === "READY",
  };
}

/* ---------------------------------------------------------- theme editor -- */
/** One-click links: add a section block to a template, or switch on an app embed. */
export function sectionLinks(shop: string) {
  const key = process.env.SHOPIFY_API_KEY;
  const base = `https://${shop}/admin/themes/current/editor`;
  const block = (handle: string, template = "index") => `${base}?template=${template}&addAppBlockId=${key}/${handle}&target=newAppsSection`;
  const embed = (handle: string) => `${base}?context=apps&activateAppId=${key}/${handle}`;
  return {
    reviews: block(SECTIONS.reviews.block),
    faq: block(SECTIONS.faq.block),
    logos: block(SECTIONS.logos.block),
    announcements: embed(SECTIONS.announcements.block),
    quick_add: embed("ucs-quick-add"),
    countdown: block("ucs-countdown"),
    countdown_bar: embed("ucs-countdown-bar"),
    boosters: embed("ucs-boosters"),
    hero: block("ucs-hero"),
    image_carousel: block("ucs-image-carousel"),
    addons: `${base}?template=product&addAppBlockId=${key}/ucs-addons&target=mainSection`,
  };
}
