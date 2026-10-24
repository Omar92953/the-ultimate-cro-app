/**
 * Loyalty → Languages: the app's translations keep every {word} of the English text, cleaning, filling a new language,
 * the language a customer or page gets, the storefront copy and the emails. Run: npm run test:app
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOYALTY, DEFAULT_PAGE, WIDGET_TEXTS, cleanLanguages, toStorefrontLoyalty, withLoyaltyDefaults, type LoyaltyConfig } from "../../app/lib/loyalty/config";
import { BUILT_IN, LANGUAGES, inLanguage, languageFor, prefill } from "../../app/lib/loyalty/languages";
import { DEFAULT_EMAIL_TEXTS, DEFAULT_EMAILS, EMAIL_KINDS, renderEmail } from "../../app/lib/loyalty/emails";

const words = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const DASH = /\s[-–—]\s|[–—]/;

test("every built in translation keeps the {words} of its English text and has no dashes", () => {
  for (const [code, b] of Object.entries(BUILT_IN)) {
    assert.ok(LANGUAGES.some((l) => l.code === code), `${code} is a listed language`);
    const pairs: [string, string, string][] = [
      ...(Object.keys(b.texts) as (keyof typeof WIDGET_TEXTS)[]).map((k) => [`texts.${k}`, WIDGET_TEXTS[k], b.texts[k]!] as [string, string, string]),
      ["page.title", DEFAULT_PAGE.title, b.page.title],
      ["page.sub", DEFAULT_PAGE.sub, b.page.sub],
      ...DEFAULT_PAGE.how.flatMap((h, i) => [[`how${i}.t`, h.t, b.page.how[i].t], [`how${i}.x`, h.x, b.page.how[i].x]] as [string, string, string][]),
      ...DEFAULT_PAGE.faq.flatMap((f, i) => [[`faq${i}.q`, f.q, b.page.faq[i].q], [`faq${i}.a`, f.a, b.page.faq[i].a]] as [string, string, string][]),
      ...EMAIL_KINDS.flatMap((k) => (["subject", "heading", "body", "button"] as const).map((p) => [`${k}.${p}`, DEFAULT_EMAIL_TEXTS[k][p], b.emails[k][p]] as [string, string, string])),
      ["footer", DEFAULT_EMAILS.footer, b.footer],
    ];
    for (const [where, en, tr] of pairs) {
      assert.ok(tr && tr.trim(), `${code} ${where} is translated`);
      assert.deepEqual(words(tr), words(en), `${code} ${where} keeps {words}: ${tr}`);
      assert.ok(!DASH.test(tr), `${code} ${where} has no dash: ${tr}`);
    }
    for (const r of DEFAULT_LOYALTY.rewards) assert.ok(b.rewards[r.title], `${code} translates the default reward ${r.title}`);
    // Every widget word has a translation (a new word needs one in each language, or it shows the main text).
    assert.deepEqual(Object.keys(b.texts).sort(), Object.keys(WIDGET_TEXTS).sort(), `${code} translates every widget word`);
  }
});

test("languages are cleaned: known codes once, known words only, at most 10", () => {
  const raw = [
    { code: "FR", texts: { launcher: "Récompenses", nope: "x", title: "" }, unit: { one: "point" }, rewards: { r1: "Remise", "bad id!": "x" }, emails: { welcome: { subject: "Bienvenue" }, nope: { subject: "x" } } },
    { code: "fr", texts: { launcher: "twice" } },
    { code: "not a code" },
    ...Array.from({ length: 12 }, (_, i) => ({ code: ["de", "es", "it", "nl", "ar", "ja", "ko", "pl", "sv", "tr", "uk", "vi"][i] })),
  ];
  const l = cleanLanguages(raw);
  assert.equal(l.length, 10);
  assert.equal(l[0].code, "fr");
  assert.deepEqual(l[0].texts, { launcher: "Récompenses" });
  assert.deepEqual(l[0].rewards, { r1: "Remise" });
  assert.deepEqual(Object.keys(l[0].emails), ["welcome"]);
  assert.equal(l[0].emails.welcome?.subject, "Bienvenue");
  assert.equal(l[0].unit.many, "");
  // Saved with the program.
  assert.equal(withLoyaltyDefaults({ languages: raw }).languages.length, 10);
  assert.deepEqual(withLoyaltyDefaults({}).languages, []);
});

test("a new language is filled with the app's translation only where the store kept the default words", () => {
  const c: LoyaltyConfig = { ...DEFAULT_LOYALTY, widget: { ...DEFAULT_LOYALTY.widget, texts: { ...DEFAULT_LOYALTY.widget.texts, launcher: "Club points" } } };
  c.page = { ...DEFAULT_PAGE, sub: "Our own words" };
  c.emails = { ...DEFAULT_EMAILS, texts: { ...DEFAULT_EMAILS.texts, welcome: { ...DEFAULT_EMAILS.texts.welcome, subject: "Hello from us" } } };
  const fr = prefill(c, "fr");
  assert.equal(fr.texts.launcher, undefined, "changed by the store: left empty");
  assert.equal(fr.texts.title, "Récompenses");
  assert.equal(fr.page.title, "Récompenses");
  assert.equal(fr.page.sub, "");
  assert.equal(fr.emails.welcome?.subject, "");
  assert.equal(fr.emails.welcome?.heading, "Vous en faites partie");
  assert.equal(fr.rewards.r1, "10 % de réduction sur votre commande");
  assert.equal(fr.unsubscribe, "Se désabonner");
  // A language the app doesn't translate starts empty.
  const ja = prefill(c, "ja");
  assert.deepEqual(ja.texts, {});
  assert.equal(ja.page.title, "");
});

test("customers and pages get their language: exact, then the base language, else the main texts", () => {
  const c = withLoyaltyDefaults({ languages: [prefill(DEFAULT_LOYALTY, "fr"), prefill(DEFAULT_LOYALTY, "pt-br")] });
  assert.equal(languageFor(c, "fr-CA")?.code, "fr");
  assert.equal(languageFor(c, "pt-BR")?.code, "pt-br");
  assert.equal(languageFor(c, "pt")?.code, "pt-br");
  assert.equal(languageFor(c, "de"), null);
  assert.equal(languageFor(c, ""), null);
  const fr = inLanguage(c, "fr");
  assert.equal(fr.widget.texts.title, "Récompenses");
  assert.equal(fr.unit.many, "points");
  assert.equal(fr.rewards.find((r) => r.id === "r2")?.title, "Livraison gratuite");
  assert.equal(fr.emails.texts.welcome.subject, "Bienvenue dans le programme de récompenses {store}");
  assert.equal(inLanguage(c, "de"), c, "no such language: the main program");
  const mail = renderEmail(fr.emails, "welcome", { name: "Shop", url: "https://shop.example" }, { balance: "10 points", unit: "points" }, "https://u.example/x");
  assert.match(mail.html, />Se désabonner</);
  assert.match(mail.text, /Se désabonner: https:\/\/u\.example\/x/);
  assert.match(renderEmail(c.emails, "welcome", { name: "Shop", url: "" }, {}, "https://u.example/x").html, />Unsubscribe</);
});

test("the storefront copy carries each language's own words, the page items falling back one by one", () => {
  assert.equal(toStorefrontLoyalty(DEFAULT_LOYALTY, true).lg, null);
  const de = { code: "de", texts: { launcher: "Prämien" }, unit: { one: "", many: "" }, page: { title: "", sub: "", how: [{ t: "Mitmachen", x: "" }], faq: [] }, rewards: { r1: "Rabatt" }, emails: {}, footer: "", unsubscribe: "" };
  const c = withLoyaltyDefaults({ languages: [de] });
  const lg = toStorefrontLoyalty(c, true).lg!;
  assert.deepEqual(lg.de.t, { launcher: "Prämien" });
  assert.equal(lg.de.u, null);
  assert.equal(lg.de.pg.title, undefined, "empty: the main title stays");
  assert.deepEqual(lg.de.pg.how[0], { t: "Mitmachen", x: DEFAULT_PAGE.how[0].x });
  assert.deepEqual(lg.de.pg.how[1], DEFAULT_PAGE.how[1]);
  assert.deepEqual(lg.de.pg.faq, DEFAULT_PAGE.faq);
  assert.deepEqual(lg.de.rw, { r1: "Rabatt" });
});

test("the storefront script picks the page's language and reads right to left ones that way", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("extensions/cro-storefront/assets/ucs-loyalty.js", "utf8");
  assert.match(src, /window\.Shopify && window\.Shopify\.locale/);
  assert.match(src, /lg\[lc\] \|\| lg\[lc\.split\('-'\)\[0\]\]/);
  const rtl = /var rtl = \/(.+)\/\.test\(lc\)/.exec(src);
  assert.ok(rtl, "a right to left check");
  const re = new RegExp(rtl![1]);
  for (const code of ["ar", "he", "fa", "ur", "ar-eg"]) assert.ok(re.test(code), code);
  for (const code of ["fr", "en", "arn", "pt-br"]) assert.ok(!re.test(code), code);
  assert.match(src, /box\.dir = 'rtl'/);
  assert.match(src, /pageEl\.dir = 'rtl'/);
});
