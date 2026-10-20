/**
 * Loader and action of the two carousel pages: Image carousel (/app/designs/image-carousel) and Image carousel 2
 * (/app/designs/image-carousel-2). Same editor (components/ImageCarouselEditor.tsx), each with its own design.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "./storefront-css.server";
import { errorMessage } from "./admin.server";
import { getThemeStatus } from "./cro.server";
import { sectionLinks } from "./sections.server";
import { getImageCarousel, saveImageCarousel } from "./designs.server";
import { withImageCarouselDefaults, type CarouselKind } from "./image-carousel";
import { getThemeStyle } from "./theme-style.server";
import { FALLBACK_STYLE } from "./theme-style";
import { slottedRoute } from "./design-slot.server";

export const carouselLoader = (kind: CarouselKind) =>
  slottedRoute([kind], async ({ request }: LoaderFunctionArgs) => {
    const { admin, session } = await authenticate.admin(request);
    const [{ config, saved }, theme] = await Promise.all([getImageCarousel(admin, kind), getThemeStatus(admin, session.shop).catch(() => null)]);
    return { kind, style: await getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE), domain: session.shop, config, saved, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed[kind] : null, addLink: sectionLinks(session.shop)[kind] };
  });

export const carouselAction = (kind: CarouselKind) =>
  slottedRoute([kind], async ({ request }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);
    const form = await request.formData();
    try {
      const { config, missing } = await saveImageCarousel(admin, withImageCarouselDefaults(JSON.parse(String(form.get("config"))), kind), form.get("intent") === "draft", kind);
      return { ok: true, draft: form.get("intent") === "draft", error: null, config, missing };
    } catch (e) {
      return { ok: false, draft: false, error: errorMessage(e), config: null, missing: 0 };
    }
  });
