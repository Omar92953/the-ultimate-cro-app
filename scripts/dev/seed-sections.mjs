/**
 * Dev only: fills the store-section lists (reviews, FAQ, logos, announcements) on the dev store
 * with sample content, using the app's own offline session from prisma/dev.sqlite.
 * Re-running updates the same items (fixed handles). Photos: Unsplash (free to use).
 *
 *   node scripts/dev/seed-sections.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const session = await prisma.session.findFirst({ where: { isOnline: false }, orderBy: { expires: "desc" } });
if (!session) throw new Error("No offline session — open the app in the admin once first.");
const API = `https://${session.shop}/admin/api/2025-10/graphql.json`;

async function gql(query, variables) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": session.accessToken },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  for (const v of Object.values(json.data ?? {})) {
    if (v?.userErrors?.length) throw new Error(JSON.stringify(v.userErrors));
  }
  return json.data;
}

const upsert = (type, handle, fields) =>
  gql(
    `mutation($h: MetaobjectHandleInput!, $m: MetaobjectUpsertInput!) { metaobjectUpsert(handle: $h, metaobject: $m) { metaobject { id } userErrors { field message } } }`,
    { h: { type, handle }, m: { fields: Object.entries(fields).map(([key, value]) => ({ key, value: String(value) })) } },
  );

/** Creates a file from a public URL (once per alt text) and returns its id. */
const fileCache = new Map();
async function file(url, alt) {
  if (fileCache.has(alt)) return fileCache.get(alt);
  // Shopify's file search is fuzzy, so only reuse a file whose alt text matches exactly.
  const found = await gql(`query($q: String!) { files(first: 20, query: $q) { nodes { id alt } } }`, { q: `alt:"${alt}"` });
  let id = found.files.nodes.find((n) => n.alt === alt)?.id;
  if (!id) {
    const made = await gql(
      `mutation($f: [FileCreateInput!]!) { fileCreate(files: $f) { files { id } userErrors { field message } } }`,
      { f: [{ originalSource: url, contentType: "IMAGE", alt }] },
    );
    id = made.fileCreate.files[0].id;
  }
  fileCache.set(alt, id);
  return id;
}
const U = (id, w = 900, h = 1100) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=75&fm=jpg`;

// Active products with a photo: review cards without their own photo show the product's.
const products = await gql(`{ products(first: 20, query: "status:active") { nodes { id title featuredMedia { id } } } }`);
const [p1, p2, p3, p4] = products.products.nodes.filter((p) => p.featuredMedia);

// ---------------------------------------------------------------- reviews --
const reviews = [
  { h: "sample-review-1", name: "Mariam A.", text: "I ordered on Sunday and it arrived on Tuesday, perfectly packed. The quality is even better than in the photos and customer service answered on WhatsApp within minutes. Will order again!", rating: 5, source: "whatsapp", location: "Cairo", verified: true, featured: true, product: p1?.id },
  { h: "sample-review-2", name: "Youssef K.", text: "Colours are even better in person.", rating: 5, source: "instagram", source_url: "https://www.instagram.com/", location: "Alexandria", verified: true, featured: true, product: p2?.id },
  { h: "sample-review-3", name: "Nour H.", text: "Got it as a gift and my friend loved it.", rating: 4, source: "tiktok", location: "Giza", verified: false, featured: true, product: p3?.id },
  { h: "sample-review-4", name: "Omar S.", text: "Fast delivery and great quality. Recommended.", rating: 5, source: "google", location: "Mansoura", verified: true, featured: false, product: p4?.id },
];
for (const [i, r] of reviews.entries()) {
  const fields = { name: r.name, text: r.text, rating: r.rating, source: r.source, location: r.location, verified: r.verified, featured: r.featured, active: true, position: i + 1, date: `2026-09-${String(10 + i * 4).padStart(2, "0")}` };
  if (r.source_url) fields.source_url = r.source_url;
  if (r.product) fields.product = r.product;
  if (r.media) fields.media = await file(U(r.media[0]), r.media[1]);
  await upsert("$app:cro_review", r.h, fields);
}
console.log(`✓ ${reviews.length} reviews`);

// -------------------------------------------------------------------- faq --
const faq = [
  ["How long does delivery take?", "2–4 working days in Cairo and Giza.\nUp to 7 days elsewhere.", "Shipping"],
  ["Do you ship outside Egypt?", "Not yet — we're working on it.", "Shipping"],
  ["Can I pay cash on delivery?", "Yes, cash on delivery is available everywhere we ship.", "Payment"],
  ["What is your return policy?", "Return unused items within 14 days for a full refund.", "Returns"],
];
for (const [i, [question, answer, group]] of faq.entries()) {
  await upsert("$app:cro_faq", `sample-faq-${i + 1}`, { question, answer, group, position: i + 1, active: true });
}
console.log(`✓ ${faq.length} questions`);

// ------------------------------------------------------------------ logos --
const logos = ["ACME", "Globex", "Initech", "Umbrella", "Hooli", "Stark"];
for (const [i, name] of logos.entries()) {
  const img = await file(`https://placehold.co/400x120/ffffff/333333/png?text=${encodeURIComponent(name)}&font=montserrat`, `Sample logo ${name}`);
  await upsert("$app:cro_logo", `sample-logo-${i + 1}`, { name, image: img, position: i + 1 });
}
console.log(`✓ ${logos.length} logos`);

// ---------------------------------------------------------- announcements --
const announce = [
  ["Free delivery on orders over $50", "/collections/all", "truck"],
  ["New arrivals every week", "/collections/all", "fire"],
  ["30-day free returns", "", "shield"],
];
for (const [i, [message, link, icon]] of announce.entries()) {
  await upsert("$app:cro_announce", `sample-announce-${i + 1}`, { message, link, icon, position: i + 1, active: true });
}
console.log(`✓ ${announce.length} announcements`);

// ------------------------------------------- ordered lists the theme reads --
// Same as the app's syncList(): shown items, sorted by their Order field.
const lists = {};
for (const [kind, type] of Object.entries({ reviews: "$app:cro_review", faq: "$app:cro_faq", logos: "$app:cro_logo", announcements: "$app:cro_announce" })) {
  const data = await gql(`query($t: String!) { metaobjects(type: $t, first: 250) { nodes { id fields { key value } } } }`, { t: type });
  const rows = data.metaobjects.nodes.map((n) => ({ id: n.id, f: Object.fromEntries(n.fields.map((x) => [x.key, x.value])) }));
  lists[kind] = JSON.stringify(rows.filter((r) => r.f.active !== "false").sort((a, b) => Number(a.f.position || 0) - Number(b.f.position || 0)).map((r) => r.id));
}
await upsert("$app:cro_lists", "main", lists);
console.log("✓ ordered lists");
await prisma.$disconnect();
