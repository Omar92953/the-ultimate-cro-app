/**
 * Share images (Open Graph and Twitter), one per page, drawn at build time with satori and resvg:
 * dark card, the logo, the page's kicker and title.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { PageMeta } from "./pages";

const font = (w: number) => readFileSync(join(process.cwd(), `node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff`));
let fonts: { name: string; data: Buffer; weight: 500 | 800; style: "normal" }[] | null = null;

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({ type, props: { style, children, ...extra } });

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#ffffff"><rect x="10" y="60" width="20" height="30" rx="5"/><rect x="40" y="42" width="20" height="48" rx="5"/><path d="M70 34 H64 L80 10 L96 34 H90 V85 Q90 90 85 90 H75 Q70 90 70 85 Z"/></g></svg>`;

export async function ogPng(page: PageMeta): Promise<Buffer> {
  fonts ??= [
    { name: "Inter", data: font(500), weight: 500, style: "normal" },
    { name: "Inter", data: font(800), weight: 800, style: "normal" },
  ];
  const title = page.ogTitle ?? page.title;
  const tree = h(
    "div",
    {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "72px 80px",
      backgroundColor: "#0b0b0f",
      backgroundImage: "radial-gradient(circle at 85% 110%, rgba(62,224,143,0.35), rgba(11,11,15,0) 55%)",
      color: "#fff",
      fontFamily: "Inter",
    },
    [
      h("div", { display: "flex", alignItems: "center", gap: 18 }, [
        h("img", { width: 56, height: 56 }, undefined, { src: `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`, width: 56, height: 56 }),
        h("div", { display: "flex", fontSize: 40, letterSpacing: -1.5 }, [h("span", { fontWeight: 800 }, "CRO"), h("span", { fontWeight: 500, marginLeft: 10 }, "Toolbox")]),
      ]),
      h("div", { display: "flex", flexDirection: "column", gap: 24 }, [
        ...(page.ogKicker
          ? [h("div", { display: "flex", alignSelf: "flex-start", fontSize: 26, fontWeight: 800, color: "#0b0b0f", background: "#3ee08f", padding: "8px 22px", borderRadius: 999 }, page.ogKicker)]
          : []),
        h("div", { display: "flex", fontSize: title.length > 40 ? 64 : 78, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, maxWidth: 1000 }, title),
      ]),
      h("div", { display: "flex", fontSize: 26, color: "#a6a8b3", fontWeight: 500 }, "Shopify app  ·  Any Online Store 2.0 theme  ·  No code"),
    ],
  );
  const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
  return new Resvg(svg).render().asPng();
}
