/**
 * What a merchant sees when a page can't load: a calm card with what to do next, never a raw
 * "Unexpected Server Error". Used by the app frame's and the root's error boundaries.
 */
import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { helpUrl } from "../lib/site";

export function ErrorPage({ title, text, help }: { title: string; text: string; help?: string }) {
  return (
    <div style={{ maxWidth: 560, margin: "48px auto", padding: "0 16px", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 1px 0 rgba(26,26,26,0.07), 0 0 0 1px rgba(26,26,26,0.08)" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 650, color: "#303030" }}>{title}</h1>
        <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5, color: "#616161" }}>{text}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: "6px 12px", border: 0, borderRadius: 8, background: "#303030", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Try again
        </button>
        {help ? (
          <a href={helpUrl(help)} target="_blank" rel="noreferrer" style={{ marginLeft: 16, fontSize: 13, color: "#005bd3" }}>
            Read the help article
          </a>
        ) : null}
      </div>
    </div>
  );
}

export const NOT_FOUND = { title: "This page doesn't exist", text: "It may have moved when the menu changed. Use the menu on the left to find what you need.", help: "getting-started" };
export const FAILED = { title: "This page couldn't load", text: "Shopify didn't answer in time or something went wrong in CRO Toolbox. Try again in a moment; if it keeps happening, email support from Settings.", help: "good-to-know" };

/** When this page last retried by itself (per page, this tab): at most once a minute, so a real outage still shows the card. */
const RETRY_KEY = "cro-error-retry";
function retriedRecently(path: string) {
  try {
    const at = Number(JSON.parse(sessionStorage.getItem(RETRY_KEY) ?? "{}")[path]) || 0;
    return Date.now() - at < 60_000;
  } catch {
    return true;
  }
}
function markRetried(path: string) {
  try {
    const all = JSON.parse(sessionStorage.getItem(RETRY_KEY) ?? "{}");
    sessionStorage.setItem(RETRY_KEY, JSON.stringify({ ...all, [path]: Date.now() }));
  } catch {
    /* no storage: the card shows at once */
  }
}

/**
 * A page that failed to load: tries once more by itself before showing the card. A one-off failure (Shopify's session
 * token late in a background tab, a slow answer) then recovers without the merchant doing anything; the real error goes
 * to the browser console so a repeat can be diagnosed.
 */
export function FailedPage({ error }: { error: unknown }) {
  const revalidator = useRevalidator();
  useEffect(() => {
    console.error("CRO Toolbox: page failed to load", error);
    const path = window.location.pathname;
    if (retriedRecently(path)) return;
    markRetried(path);
    revalidator.revalidate();
    // Once per failure: the revalidator object changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
  // While it loads again; if that works this page is replaced by the real one, otherwise the card stays.
  if (revalidator.state === "loading") return <ErrorPage title="Loading again" text="Shopify took a moment to answer. Trying once more." />;
  return <ErrorPage {...FAILED} />;
}
