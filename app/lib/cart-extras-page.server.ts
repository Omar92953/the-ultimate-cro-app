/**
 * The loader and save of the cart extras design, shared by its two pages: Gift note & delivery date and Discount code box
 * (same storage, $app:cro_design "cart_extras", and the same theme block).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "./storefront-css.server";
import { errorMessage } from "./admin.server";
import { getThemeStatus } from "./cro.server";
import { sectionLinks } from "./sections.server";
import { getCartExtras, saveCartExtras } from "./designs.server";
import { getThemeStyle } from "./theme-style.server";
import { FALLBACK_STYLE } from "./theme-style";
import { withCartExtrasDefaults } from "./cart-extras-design";

export async function loadCartExtrasPage({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style] = await Promise.all([getCartExtras(admin), getThemeStatus(admin, session.shop).catch(() => null), getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE)]);
  const links = sectionLinks(session.shop);
  return { config, saved, style, domain: session.shop, css: storefrontCss("ucs-sections.css") + storefrontCss("ucs-cart-extras.css"), inTheme: theme ? theme.installed.cart_extras : false, boostersOn: theme ? theme.installed.boosters : null, addLink: links.cart_extras, boostersLink: links.boosters };
}

export async function saveCartExtrasPage({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveCartExtras(admin, withCartExtrasDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
}

export type CartExtrasPageData = Awaited<ReturnType<typeof loadCartExtrasPage>>;
export type CartExtrasSaveResult = Awaited<ReturnType<typeof saveCartExtrasPage>>;
