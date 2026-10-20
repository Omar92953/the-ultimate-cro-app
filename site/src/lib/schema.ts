/** schema.org structured data, built from the same sources as the visible page. */
import { plans } from "./app";
import { SITE_NAME, SITE_URL, INSTALL_URL, SOCIAL, PROFILES, SUPPORT_EMAIL, OPERATOR } from "./site";
import { BRAND_LINE } from "./brand";
import type { QA } from "../components/Faq.astro";

const strip = (html: string) => html.replace(/<[^>]+>/g, "");
/** Every profile that exists (footer icons and directory profiles), and the App Store listing once live. */
const sameAs = [...new Set([...Object.values(SOCIAL), ...Object.values(PROFILES), INSTALL_URL].filter(Boolean))];

export const organization = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  description: BRAND_LINE,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  ...(SUPPORT_EMAIL ? { email: SUPPORT_EMAIL, contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL, url: `${SITE_URL}/support/`, availableLanguage: "English" } } : {}),
  ...(OPERATOR ? { parentOrganization: { "@type": "Organization", name: OPERATOR } } : {}),
  ...(sameAs.length ? { sameAs } : {}),
});

export const website = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
});

/** The app, with its real prices (monthly and yearly) from plans.ts. No ratings until there are real reviews. */
export const softwareApplication = (description: string) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Shopify app",
  operatingSystem: "Shopify",
  url: SITE_URL,
  ...(INSTALL_URL ? { installUrl: INSTALL_URL } : {}),
  description,
  offers: plans.flatMap((p) => [
    {
      "@type": "Offer",
      name: p.monthly ? `${p.name} (monthly)` : p.name,
      price: p.monthly.toFixed(2),
      priceCurrency: "USD",
      ...(p.monthly ? { priceSpecification: { "@type": "UnitPriceSpecification", price: p.monthly.toFixed(2), priceCurrency: "USD", unitCode: "MON" } } : {}),
    },
    ...(p.yearly
      ? [
          {
            "@type": "Offer",
            name: `${p.name} (yearly)`,
            price: p.yearly.toFixed(2),
            priceCurrency: "USD",
            priceSpecification: { "@type": "UnitPriceSpecification", price: p.yearly.toFixed(2), priceCurrency: "USD", unitCode: "ANN" },
          },
        ]
      : []),
  ]),
});

export const faqPage = (items: QA[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((it) => ({
    "@type": "Question",
    name: it.q,
    acceptedAnswer: { "@type": "Answer", text: strip(it.a) },
  })),
});
