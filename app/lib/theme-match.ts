/**
 * "Match my theme style" for the sections whose colours are stored in their design: copies one of the
 * theme's colour schemes (and its corners) into the section's own colour settings. Works on every
 * theme, and each colour stays editable afterwards. Shared by client and server.
 */
import type { AddonsConfig } from "./addons";
import type { AnnouncementDesign } from "./announcement-design";
import type { LogosDesign } from "./logos-design";
import type { FaqDesign } from "./faq-design";
import type { HeroDesign } from "./hero-design";
import type { QuickAddDesign } from "./quick-add-design";
import type { CollectionPillsConfig } from "./collection-pills";
import type { CountdownBarConfig } from "./designs";
import type { HeaderConfig } from "./header";
import type { ImageCarouselConfig } from "./image-carousel";
import type { ContactConfig } from "./pages";
import type { ReviewsDesign } from "./reviews-design";
import type { ShippingBarConfig } from "./shipping-bar";
import { mix, type ThemeScheme, type ThemeStyle } from "./theme-style";

const line = (s: ThemeScheme, pct = 0.18) => mix(s.text, s.bg, pct);

export const matchShippingBar = (c: ShippingBarConfig, s: ThemeScheme, st: ThemeStyle): ShippingBarConfig => ({
  ...c,
  scheme: s.id,
  look: { ...c.look, bg: s.bg, text: s.text, fill: s.button, done: s.button, track: line(s, 0.2), radius: c.look.style === "card" ? Math.min(st.radius.card, 24) : c.look.radius },
});

export const matchPills = (c: CollectionPillsConfig, s: ThemeScheme, st: ThemeStyle): CollectionPillsConfig => ({
  ...c,
  scheme: s.id,
  look: { ...c.look, text: s.text, bg: s.bg, border: line(s, 0.22), activeText: s.buttonText, activeBg: s.button, radius: st.radius.pill || st.radius.button },
});

export const matchImageCarousel = (c: ImageCarouselConfig, s: ThemeScheme, st: ThemeStyle): ImageCarouselConfig => ({
  ...c,
  scheme: s.id,
  layout: { ...c.layout, radius: Math.min(st.radius.media, 40) },
  look: { ...c.look, buttonBg: s.button, buttonText: s.buttonText, ...(c.layout.captions === "below" ? { text: s.text } : {}) },
});

export const matchAddons = (c: AddonsConfig, s: ThemeScheme, st: ThemeStyle): AddonsConfig => ({
  ...c,
  scheme: s.id,
  look: { ...c.look, accent: s.button, bg: s.bg, border: line(s, 0.15), radius: Math.min(st.radius.card, 24) },
});

export const matchHeader = (c: HeaderConfig, s: ThemeScheme): HeaderConfig => ({
  ...c,
  scheme: s.id,
  look: { ...c.look, bg: s.bg, text: s.text, border: line(s, 0.12), accent: s.button, accentText: s.buttonText, panelBg: s.bg, panelText: s.text },
});

export const matchReviews = (c: ReviewsDesign, s: ThemeScheme, st: ThemeStyle): ReviewsDesign => {
  const page = st.schemes[0]?.id === s.id; // the page's own scheme: no background of its own
  return {
    ...c,
    scheme: s.id,
    look: { ...c.look, transparentBg: page, bg: s.bg, defaultCard: false, cardBg: mix(s.text, s.bg, 0.04), cardText: s.text, radius: Math.min(st.radius.card, 40) },
  };
};

export const matchCountdown = (c: CountdownBarConfig, s: ThemeScheme, st: ThemeStyle): CountdownBarConfig => ({
  ...c,
  scheme: s.id,
  look: { ...c.look, bg: s.bg, text: s.text, boxBg: s.button, boxText: s.buttonText, buttonBg: s.button, buttonText: s.buttonText, buttonRadius: Math.min(st.radius.button, 40), font: "theme" },
});

export const matchContact = (c: ContactConfig, s: ThemeScheme, st: ThemeStyle): ContactConfig => ({
  ...c,
  scheme: s.id,
  look: { ...c.look, bgType: "color", bg: mix(s.text, s.bg, 0.04), card: s.bg, text: s.text, fieldBg: s.bg, fieldBorder: line(s, 0.25), accent: s.button, accentText: s.buttonText, radius: Math.min(st.radius.input, 24) },
});

export const matchAnnouncement = (c: AnnouncementDesign, s: ThemeScheme): AnnouncementDesign => ({ ...c, scheme: s.id, look: { ...c.look, bg: s.bg, fg: s.text } });

export const matchQuickAdd = (c: QuickAddDesign, s: ThemeScheme, st: ThemeStyle): QuickAddDesign => ({
  ...c,
  scheme: s.id,
  button: { ...c.button, bg: s.bg, fg: s.text },
  popup: { ...c.popup, vcBg: s.bg, vcText: s.text, vcBorder: s.text, coBg: s.button, coText: s.buttonText, coBorder: s.button, radius: Math.min(st.radius.button, 99) },
});

export const matchLogos = (c: LogosDesign, s: ThemeScheme): LogosDesign => ({ ...c, scheme: s.id, look: { ownBg: true, bg: s.bg, ownText: true, fg: s.text } });

export const matchFaq = (c: FaqDesign, s: ThemeScheme): FaqDesign => ({
  ...c,
  scheme: s.id,
  look: { ...c.look, ownBg: true, bg: s.bg, ownText: true, fg: s.text, ownCard: c.look.style === "cards" || c.look.ownCard, cardBg: mix(s.text, s.bg, 0.06), accent: s.button },
});

/** Hero: text and buttons in the scheme's colours, the overlay / text box in its background. */
export const matchHero = (c: HeroDesign, s: ThemeScheme): HeroDesign => ({
  ...c,
  scheme: s.id,
  look: { ...c.look, fg: s.text, buttonBg: s.button, buttonFg: s.buttonText, overlay: s.bg, boxBg: s.bg },
});
