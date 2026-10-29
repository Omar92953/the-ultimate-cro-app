/**
 * The MCP tools for tracking: an assistant can see how the store gets tracking and which shipping companies its
 * shipments use, then guide the merchant through connecting any of them (Tracking & Returns → where tracking comes
 * from). It can add carrier links and choose the source, but never takes a tracking service key or sees the webhook
 * link: both are secrets the merchant pastes or copies in the app.
 */
import { atLeast, PLANS } from "../plans";
import { carrierLinkProblem, cleanCarrierLinks, MAX_CARRIER_LINKS, type TrackSource } from "../tracking";
import { getTrackingConfig, saveCarrierLinks, saveSource } from "../tracking/tracking.server";
import { recentShipments } from "../tracking/shipments.server";
import { PROVIDERS } from "../tracking/provider.server";
import { DATA_NOTE, type Tool, type ToolContext } from "./tools.server";
import { obj } from "./shared.server";

const PAGE = "Tracking & Returns, then Where tracking comes from";

/** The ways to connect a shipping company, in the words the assistant passes on. */
export const TRACKING_WAYS = [
  { source: "shopify", title: "The courier's own Shopify app", how: "Many couriers have a Shopify app that adds the tracking number and its updates to the store's orders; the Track page shows what Shopify gets, with nothing more to set up. Help the merchant check the Shopify App Store for their courier's app and whether it sends tracking updates." },
  { source: "own", title: "Tracking service key", how: `The merchant's own account at 17TRACK, AfterShip, TrackingMore or Ship24 (each follows thousands of carriers worldwide). The merchant creates the account, finds the API key (usually Settings, then API or Developers) and pastes it in the Key field on ${PAGE}, then presses Test and save. Never ask for the key in the chat.` },
  { source: "webhook", title: "Webhook link", how: `For a shipping company, warehouse or 3PL that can send updates to a link. The merchant chooses Webhook link on ${PAGE} and copies the private link from there (never ask for it in the chat). Updates from 17TRACK, AfterShip, TrackingMore and Ship24 are read as they are; anything else POSTs JSON in webhookFormat.` },
  { source: "carrier_link", title: "Carrier tracking page link", how: "For a courier Shopify has no tracking link for: its name as it shows on fulfillments and its tracking page address with {number} where the tracking number goes. Use set_carrier_link." },
  { source: "manual", title: "Updates typed by the merchant", how: "For a courier with no tracking system: in Tracking & Returns, Shipments, Add update on a shipment." },
] as const;

const WEBHOOK_FORMAT = {
  number: "TRACKING123",
  status: "transit (one of info, transit, out, delivered, problem)",
  estimated: "2026-11-05",
  events: [{ status: "transit", city: "Cairo", province: "", country: "EG", message: "Arrived at the sorting center", at: "2026-11-02T10:30:00Z" }],
};

function needsGrowth(ctx: ToolContext) {
  if (!atLeast(ctx.plan, "growth")) throw new Error(`Tracking sources are on the Growth and Pro plans; this store is on ${PLANS[ctx.plan].name}. Plans: ${ctx.planUrl}`);
}

export const TRACKING_TOOLS: Tool[] = [
  {
    name: "get_tracking_setup",
    description: `How this store's Track page gets tracking: the source in use, whether a tracking service key or webhook link is set up, the carrier links, the shipping companies on its recent shipments, and every way to connect a shipping company with the steps to pass on to the merchant. Start here to help connect any shipping company: ask which courier and country, search the web for what that courier offers merchants (its Shopify app, its API or webhook, which tracking services support it), list the ways that fit with free ones first, then guide one step at a time.` + DATA_NOTE,
    needs: "read",
    schema: obj({}),
    async run(ctx) {
      const cfg = await getTrackingConfig(ctx.shop, ctx.plan);
      const shipments = cfg.advanced ? await recentShipments(ctx.admin, ctx.shop, cfg.source, ctx.plan).catch(() => []) : [];
      const companies = [...new Set(shipments.map((s) => s.company).filter(Boolean))];
      return {
        plan: PLANS[ctx.plan].name,
        canConnect: cfg.advanced,
        planUrl: cfg.advanced ? undefined : ctx.planUrl,
        sourceInUse: cfg.source,
        trackingServiceKey: cfg.hasKey ? { connected: true, endsWith: cfg.keyLast4 } : { connected: false, services: PROVIDERS.map((p) => p.id) },
        webhookLinkReady: !!cfg.webhookUrl,
        carrierLinks: cfg.carrierLinks,
        recentShippingCompanies: companies,
        recentShipmentsWithoutCompany: shipments.filter((s) => !s.company).length,
        fallback: "The Track page always falls back to Shopify's own tracking data, so nothing breaks while the merchant sets this up.",
        ways: TRACKING_WAYS,
        webhookFormat: WEBHOOK_FORMAT,
        settingsPage: PAGE,
      };
    },
  },
  {
    name: "set_carrier_link",
    description: "Adds or replaces the tracking page link for one shipping company Shopify has no link for, so the Track page links each shipment to it. name: the company as it shows on fulfillments (* for any carrier without a link). url: https address with {number} where the tracking number goes. Applies to the Track page at once.",
    needs: "publish",
    schema: obj({ name: { type: "string", description: "The shipping company's name, as on fulfillments." }, url: { type: "string", description: "https://… with {number} where the tracking number goes." } }, ["name", "url"]),
    summary: (a) => `carrier link ${String(a.name ?? "").slice(0, 40)}`,
    async run(ctx, args) {
      const link = { name: String(args.name ?? "").trim().slice(0, 60), url: String(args.url ?? "").trim().slice(0, 300) };
      const problem = carrierLinkProblem(link);
      if (problem) throw new Error(problem);
      const cfg = await getTrackingConfig(ctx.shop, ctx.plan);
      const same = (n: string) => n.trim().toLowerCase() === link.name.toLowerCase();
      const others = cfg.carrierLinks.filter((l) => !same(l.name));
      if (others.length >= MAX_CARRIER_LINKS) throw new Error(`There are already ${MAX_CARRIER_LINKS} carrier links; remove one in the app first.`);
      const saved = await saveCarrierLinks(ctx.shop, cleanCarrierLinks([...others, link]));
      return { saved: true, carrierLinks: saved };
    },
  },
  {
    name: "set_tracking_source",
    description: `Chooses where the Track page gets tracking: shopify (Shopify's data), own (the tracking service key the merchant saved in the app) or webhook (makes the private webhook link, which the merchant copies on ${PAGE}). Growth and Pro. Applies at once.`,
    needs: "publish",
    schema: obj({ source: { type: "string", enum: ["shopify", "own", "webhook"] } }, ["source"]),
    summary: (a) => `tracking source ${String(a.source ?? "")}`,
    async run(ctx, args) {
      needsGrowth(ctx);
      const source = String(args.source) as TrackSource;
      if (!["shopify", "own", "webhook"].includes(source)) throw new Error("Choose shopify, own or webhook.");
      await saveSource(ctx.shop, ctx.plan, source);
      return { sourceInUse: source, next: source === "webhook" ? `The merchant copies the webhook link on ${PAGE} and gives it to the shipping company.` : undefined };
    },
  },
];
