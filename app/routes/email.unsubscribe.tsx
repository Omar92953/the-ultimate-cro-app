/**
 * The unsubscribe link in every loyalty email (/email/unsubscribe?t=...). Mail apps POST to it for one-click
 * unsubscribe (List-Unsubscribe-Post); a person opening the link gets a page with a button, so link scanners
 * that only open links don't unsubscribe anyone. Public: the signed token says which member it is.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { readUnsubToken, unsubscribe } from "../lib/loyalty/mailer.server";

const page = (title: string, text: string, form = "") =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
      `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111}main{max-width:420px;margin:24px;padding:32px;background:#fff;border-radius:16px;text-align:center}h1{font-size:22px;margin:0 0 10px}p{color:#555;line-height:1.5}button{margin-top:12px;padding:12px 24px;border:0;border-radius:999px;background:#111;color:#fff;font:inherit;font-weight:600;cursor:pointer}</style></head>` +
      `<body><main><h1>${title}</h1><p>${text}</p>${form}</main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const t = new URL(request.url).searchParams.get("t") ?? "";
  if (!readUnsubToken(t)) return page("Link not valid", "This unsubscribe link is not complete. Open it again from the email.");
  const safe = t.replace(/[^A-Za-z0-9._-]/g, "");
  return page("Unsubscribe", "Stop getting rewards emails from this store?", `<form method="post" action="?t=${safe}"><button type="submit">Unsubscribe</button></form>`);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const done = await unsubscribe(new URL(request.url).searchParams.get("t") ?? "");
  return done ? page("You are unsubscribed", "You won't get rewards emails from this store any more. Your points stay yours.") : page("Link not valid", "This unsubscribe link is not complete. Open it again from the email.");
};
