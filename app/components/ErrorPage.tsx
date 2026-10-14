/**
 * What a merchant sees when a page can't load: a calm card with what to do next, never a raw
 * "Unexpected Server Error". Used by the app frame's and the root's error boundaries.
 */
export function ErrorPage({ title, text }: { title: string; text: string }) {
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
      </div>
    </div>
  );
}

export const NOT_FOUND = { title: "This page doesn't exist", text: "It may have moved when the menu changed. Use the menu on the left to find what you need." };
export const FAILED = { title: "This page couldn't load", text: "Shopify didn't answer in time or something went wrong on our side. Try again in a moment; if it keeps happening, email support from Settings." };
