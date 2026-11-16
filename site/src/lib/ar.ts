/**
 * The Arabic section (/ar/): page titles and descriptions, the English page each one mirrors (hreflang), the header
 * and footer links, and Arabic words for the lines the site reads from the app (plan cards, loyalty extras).
 *
 * Numbers always come from the app (plans.ts through lib/app.ts). Text the app writes in English is turned into Arabic
 * with the dictionaries below; a line with no Arabic yet shows in English and the build prints a warning, so a change
 * in plans.ts never breaks the site. Add the missing line here when you see the warning.
 */
import { plans, PLANS, FEATURE_PLAN, money, trialDays, cheapestPaid, type Plan, type PlanKey, type RecipeKey, type AreaKey } from "./app";
import { featurePath, type PageMeta } from "./pages";
import { installHref } from "./site";

export const AR_HOME = "/ar/";
/** Where an Arabic Install button goes while the App Store listing isn't live: the Arabic "Get notified" block. */
export const AR_NOTIFY_HREF = "/ar/#get-notified";
export const arInstallHref = (medium: string, campaign: string) => {
  const href = installHref(medium, campaign);
  return href.startsWith("/#") ? AR_NOTIFY_HREF : href;
};

/** The shared description (brand.ts), in Arabic. */
export const AR_BRAND_LINE =
  "CRO Toolbox هو كل أدوات البيع لمتجرك في تطبيق Shopify واحد: الباقات، والبيع الإضافي والمتقاطع، وأقسام المتجر، والولاء والمكافآت، وتتبع الطلبات والمرتجعات.";

/**
 * "$5.99" and "15%" read left to right inside Arabic text: Unicode isolates around them keep "و$19.99" from turning
 * into "و19.99$" or swapping places with the next price.
 */
export const ltr = (s: string) => s.replace(/\$\d[\d,.]*|\d[\d,.]*%/g, (m) => `⁦${m}⁩`);
export const arMoney = (n: number) => ltr(money(n));

const paid = plans.filter((p) => p.monthly > 0);

/** An Arabic page: its own meta, and the English page it mirrors (hreflang both ways, the language links). */
export type ArPage = PageMeta & { en: string };

export const AR_PAGES = {
  home: {
    slug: "ar-home",
    path: "/ar/",
    en: "/",
    title: "CRO Toolbox: كل أدوات البيع لمتجر Shopify في تطبيق واحد",
    description: `${AR_BRAND_LINE} خطة مجانية، والخطط المدفوعة من ${arMoney(cheapestPaid.monthly)} شهرياً.`,
    ogImageSlug: "home",
    ogAlt: "صورة مشاركة CRO Toolbox: كل أدوات البيع في تطبيق Shopify واحد",
  },
  pricing: {
    slug: "ar-pricing",
    path: "/ar/pricing/",
    en: "/pricing/",
    title: "أسعار CRO Toolbox وخططه",
    description: `خطة ${PLANS.free.name} مجانية، و${paid.map((p) => `${p.name} بسعر ${arMoney(p.monthly)}`).join(" و")} شهرياً، أو بالدفع السنوي. تجربة مجانية ${trialDays} يوماً على كل خطة مدفوعة.`,
    ogImageSlug: "pricing",
    ogAlt: "صورة مشاركة CRO Toolbox: الأسعار",
  },
  loyalty: {
    slug: "ar-loyalty",
    path: "/ar/features/loyalty-program/",
    en: featurePath("loyalty"),
    title: "برنامج ولاء لمتجر Shopify بالعربية",
    description: `نقاط على الطلبات، ومكافآت، ومتجر نقاط، وإحالات، بترجمة عربية جاهزة ومن اليمين لليسار. على خطة ${PLANS[FEATURE_PLAN.loyalty].name} بسعر ${arMoney(PLANS[FEATURE_PLAN.loyalty].monthly)} شهرياً.`,
    ogImageSlug: "feature-loyalty-program",
    ogAlt: "صورة مشاركة CRO Toolbox: برنامج الولاء",
  },
  payment: {
    slug: "ar-payment-rules",
    path: "/ar/features/payment-rules/",
    en: featurePath("payment_rules"),
    title: "إخفاء الدفع عند الاستلام في Shopify",
    description: "أخفِ الدفع عند الاستلام حسب قيمة الطلب أو الدولة أو المنتجات أو نوع العميل، أو غيّر اسمه وترتيبه في صفحة الدفع. متاح على الخطة المجانية وبدون Shopify Plus.",
    ogImageSlug: "feature-payment-rules",
    ogAlt: "صورة مشاركة CRO Toolbox: قواعد الدفع",
  },
  bundles: {
    slug: "ar-bundles",
    path: "/ar/bundles/",
    en: "/bundles/",
    title: "باقات المنتجات في Shopify: ست طرق للبيع معاً",
    description: "اشترِ معاً بخصم، وباقة كمنتج واحد، واختر وكوّن باقتك، وخصم يكبر مع عدد القطع، وسعر ثابت لأي عدد. ست أنواع من الباقات، وسعرها تطبّقه Shopify في صفحة الدفع.",
    ogImageSlug: "bundles",
    ogAlt: "صورة مشاركة CRO Toolbox: الباقات",
  },
} satisfies Record<string, ArPage>;

export const AR_PAGE_LIST: ArPage[] = Object.values(AR_PAGES);

/** The language pair of a page (Arabic or English side), for hreflang links and the language switch. */
export const languagePair = (path: string): { en: string; ar: string } | undefined => {
  const p = AR_PAGE_LIST.find((x) => x.path === path || x.en === path);
  return p ? { en: p.en, ar: p.path } : undefined;
};

export type ArLink = { label: string; href: string };
export const AR_NAV: ArLink[] = [
  { label: "الباقات", href: AR_PAGES.bundles.path },
  { label: "برنامج الولاء", href: AR_PAGES.loyalty.path },
  { label: "الدفع عند الاستلام", href: AR_PAGES.payment.path },
  { label: "الأسعار", href: AR_PAGES.pricing.path },
];

/** Footer: the Arabic pages, then English pages a merchant may still need (support, legal). */
export const AR_FOOTER: { title: string; links: ArLink[] }[] = [
  {
    title: "بالعربية",
    links: [{ label: "الرئيسية", href: AR_HOME }, ...AR_NAV],
  },
  {
    title: "صفحات بالإنجليزية",
    links: [
      { label: "كل المزايا", href: "/features/" },
      { label: "مركز المساعدة", href: "/help/" },
      { label: "الدعم", href: "/support/" },
      { label: "بياناتك وأمانها", href: "/security/" },
      { label: "سياسة الخصوصية", href: "/privacy/" },
      { label: "شروط الخدمة", href: "/terms/" },
    ],
  },
];

/* ------------------------------------------------------------ words from the app, in Arabic -- */

const warned = new Set<string>();
const missing = (en: string) => {
  if (!warned.has(en)) console.warn(`[ar] no Arabic for "${en}": add it to site/src/lib/ar.ts`);
  warned.add(en);
  return en;
};

/**
 * Plan lines from plans.ts. Numbers are matched as "#" and put back in order, so a changed number needs no edit here.
 * Arabic phrasing puts the number after a colon where it can, so the noun never has to agree with the number.
 */
const LINES: Record<string, string> = {
  "# offers on at once": "عروض مفعّلة في وقت واحد: #",
  "Cart offers and announcement bars": "عروض داخل السلة وأشرطة إعلانات",
  "Reviews, FAQ and wishlist": "التقييمات والأسئلة الشائعة وقائمة الأمنيات",
  "Sales pop-ups and trust badges": "إشعارات المبيعات وشارات الثقة",
  "After purchase offer and thank you": "عرض بعد الدفع وصفحة الشكر",
  "# checkout rules": "قواعد صفحة الدفع: #",
  "Try # Starter feature free": "مزايا من Starter تجربها مجاناً: #",
  "Unlimited offers": "عروض بلا حد",
  "Every bundle and discount type": "كل أنواع الباقات والخصومات",
  "Add-ons and personalization": "الإضافات وتخصيص المنتج",
  "Gift note and delivery date": "رسالة الهدية وموعد التوصيل",
  "Quiz, carousels and store pages": "اختبار اختيار المنتج والعروض المتحركة وصفحات المتجر",
  "# styles per section": "تصاميم لكل قسم: #",
  "Connect AI assistants to your store": "ربط مساعدي الذكاء الاصطناعي بمتجرك",
  "Everything in Starter": "كل ما في Starter",
  "Everything in Growth": "كل ما في Growth",
  "Unlimited checkout rules": "قواعد صفحة الدفع بلا حد",
  "Offer results and a holdout test": "نتائج كل عرض واختبار مقارنة",
  "Track and Returns pages": "صفحتا تتبع الطلب والمرتجعات",
  "Live tracking, # shipments a month": "شحنات بتتبع مباشر شهرياً: #",
  "Loyalty for # orders a month": "برنامج ولاء، طلبات تكسب نقاطاً شهرياً: #",
  "Your tracking page sells too": "صفحة التتبع تبيع أيضاً",
  "Shoppable images": "صور قابلة للتسوق",
  "A/B tests with up to # versions": "اختبارات A/B بحد أقصى # نسخ",
  "Scheduled offers": "عروض مجدولة",
  "VIP tiers, Klaviyo and Shopify Flow": "مستويات VIP وKlaviyo وShopify Flow",
  "Store credit and exchanges on returns": "رصيد المتجر والاستبدال بدل الاسترداد",
  "Auto approve and restock returns": "قبول المرتجعات وإرجاعها للمخزون تلقائياً",
  "Track page offer slots": "مساحات عروض في صفحة التتبع",
  "Priority support": "دعم بأولوية",
  // Plan jobs and the guarantee.
  "Try everything: a little of every tool, free forever.": "جرّب كل شيء: قدر من كل أداة، مجاناً دائماً.",
  "Sell more per order: every offer, bundle and storefront tool.": "بيع أكثر في كل طلب: كل العروض والباقات وأدوات واجهة المتجر.",
  "Convert and optimise: checkout control and the numbers behind every offer.": "حوّل الزيارات إلى طلبات: تحكم في صفحة الدفع واعرف نتيجة كل عرض.",
  "Test, save returns and sell more, with no limits.": "اختبر، وأنقذ المرتجعات، وبع أكثر بلا حدود.",
  "Cancel or change your plan anytime. No contract.": "ألغِ خطتك أو غيّرها في أي وقت. بدون عقد.",
  // What Pro adds to loyalty (LOYALTY_PRO in app/lib/loyalty/config.ts).
  "VIP tiers": "مستويات VIP",
  "bonus campaigns": "حملات نقاط إضافية",
  "product and collection rules": "قواعد نقاط للمنتجات والمجموعات",
  cashback: "استرداد نقدي كرصيد في المتجر",
  "affiliate links": "روابط للمسوّقين بالعمولة",
  "Klaviyo, Omnisend, Judge.me and Shopify Flow": "الربط مع Klaviyo وOmnisend وJudge.me وShopify Flow",
};

/** The Arabic for a line from the app (numbers kept as they are). */
export function arLine(en: string): string {
  const nums = en.match(/\d[\d,.]*/g) ?? [];
  const key = en.replace(/\d[\d,.]*/g, "#");
  const t = LINES[key];
  if (!t) return missing(en);
  let i = 0;
  return t.replace(/#/g, () => nums[i++] ?? "#");
}

/** Plan badges: "Popular" is said as a recommendation, since there are no install numbers yet. */
const BADGES: Record<string, string> = { Popular: "ننصح بها", "No limits": "بلا حدود" };
export const arBadge = (b: string) => BADGES[b] ?? missing(b);

/** "Orders a month: 50" / "Unlimited orders". */
export const arOrders = (p: Plan) => (p.limits.monthlyOrders === null ? "طلبات بلا حد" : `الطلبات شهرياً: ${p.limits.monthlyOrders.toLocaleString("en-US")}`);
export const arNum = (n: number | null) => (n === null ? "بلا حد" : n.toLocaleString("en-US"));
/** "Free plan" / "Starter plan ($5.99 a month)". */
export const arPlan = (k: PlanKey) => {
  const p = PLANS[k];
  return p.monthly ? `خطة ${p.name} (${arMoney(p.monthly)} شهرياً)` : `خطة ${p.name} المجانية`;
};

/** The app's areas (catalog.ts), in Arabic, for the home page. */
export const AR_AREAS: Record<AreaKey | "analytics", { title: string; intro: string }> = {
  offers: { title: "العروض", intro: "بيع إضافي ومتقاطع، وباقات، وخصومات، وعروض في السلة وبعد الدفع." },
  loyalty: { title: "الولاء", intro: "نقاط على كل طلب، ومكافآت، ومستويات VIP، وإحالات تعيد العملاء إليك." },
  tracking: { title: "التتبع والمرتجعات", intro: "صفحة لتتبع الطلب تعرض منتجاتك، وصفحة مرتجعات تقترح الاستبدال أو رصيد المتجر." },
  library: { title: "مكتبة الأقسام", intro: "أقسام جاهزة لقالب متجرك: صور متحركة، وفيديوهات، وأسئلة شائعة، ومقارنة، وغيرها." },
  cart: { title: "السلة وصفحة الدفع", intro: "شريط الشحن المجاني، وإضافات السلة، وقواعد الدفع والتوصيل، وحدود الطلب، وصفحة الشكر." },
  analytics: { title: "التحليلات", intro: "مبيعات التطبيق في آخر 30 يوماً، ونتائج كل عرض وكل باقة، واختبار مقارنة." },
};

/** The six bundle recipes (bundle-recipes.ts keys never change), in Arabic. Example prices are made up for the demo store. */
type ArRecipe = { title: string; about: string; best: string; price: string; where: string; example: string };
const RECIPES_RAW: Record<RecipeKey, ArRecipe> = {
  fbt: {
    title: "يُشترى معاً غالباً",
    about: "مجموعة منتجات تظهر في صفحة كل منتج منها، بخصم عند شرائها معاً.",
    best: "الإكسسوارات والمنتجات التي تكمّل منتجاً أساسياً.",
    price: "نسبة خصم عند شراء كل القطع معاً.",
    where: "في صفحة كل منتج من المجموعة، مع زر «اشترِ الكل».",
    example: "طقم المساء: شمعة وكوب وصابون، بخصم 15% معاً.",
  },
  kit: {
    title: "باقة ثابتة (تُباع كمنتج واحد)",
    about: "طقم جاهز له صفحته وصورته وسعره، ويظهر في السلة كسطر واحد.",
    best: "أطقم الهدايا وأطقم البداية والعبوات المتعددة.",
    price: "سعر خاص بها، وتخصم Shopify كل قطعة من المخزون.",
    where: "في صفحة منتج خاصة بها، وسطر واحد في السلة.",
    example: "طقم ليلة هادئة: شمعة وكريم وصابون في علبة واحدة، بسعر $62 بدل $74.",
  },
  mixmatch: {
    title: "اختر وامزج",
    about: "يختار العميل القطع من مجموعة في صفحة الباقة، بسعر واحد.",
    best: "صناديق «كوّن صندوقك».",
    price: "سعر واحد للصندوق، أو نسبة خصم على القطع، أو مستويات.",
    where: "في صفحة منتج الباقة، أو صفحة خاصة يصنعها التطبيق.",
    example: "صندوق الشموع: أي 3 شموع من مجموعة الشموع بسعر $56.",
  },
  browse: {
    title: "كوّن باقتك أثناء التصفح",
    about: "يضيف العميل القطع إلى باقته من صفحات المجموعات، وشريط صغير يرافقه وهو يتنقل.",
    best: "المتاجر الكبيرة والمجموعات الطويلة.",
    price: "سعر الباقة بعد اكتمال كل الخطوات.",
    where: "صفحات المجموعات (زر «أضف إلى الباقة» على كل منتج)، وصفحات المنتجات، وشريط يرافق العميل.",
    example: "حقيبة هدية يكوّنها العميل وهو يتصفح المجموعات.",
  },
  growing: {
    title: "باقة بمستويات (اشترِ أكثر ووفّر أكثر)",
    about: "كلما أضاف العميل قطعاً أكثر كبر الخصم (قطعتان بخصم 10%، و3 قطع بخصم 15%).",
    best: "رفع قيمة الطلب.",
    price: "خصم أكبر مع كل قطعة إضافية: بنسبة، أو بمبلغ، أو بسعر محدد.",
    where: "في صفحة منتج، أو صفحة خاصة يصنعها التطبيق.",
    example: "كوّن طقم العناية: قطعتان بخصم 10%، و3 بخصم 15%، و4 بخصم 20%.",
  },
  anyN: {
    title: "باقة بسعر ثابت (أي 3 بسعر $30)",
    about: "أي 3 قطع بسعر $30، وأي 6 بسعر $55، يختارها العميل من مجموعة طويلة.",
    best: "الجوارب والشموع والوجبات الخفيفة.",
    price: "سعر محدد لعدد من القطع، مثل أي 3 بسعر $30.",
    where: "في صفحة منتج، والمجموعات الطويلة فيها «عرض المزيد» ومربع بحث.",
    example: "درج الجوارب: أي 3 أزواج بسعر $30، وأي 6 بسعر $55.",
  },
};

export const AR_RECIPES = Object.fromEntries(
  Object.entries(RECIPES_RAW).map(([k, r]) => [k, Object.fromEntries(Object.entries(r).map(([f, v]) => [f, ltr(v)])) as ArRecipe]),
) as Record<RecipeKey, ArRecipe>;
