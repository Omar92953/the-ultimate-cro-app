/** Live preview of the delivery estimate, using the same date maths as the store (estimate()). */
import { useEffect, useState, type CSSProperties } from "react";
import { deliveryClass, deliveryVars, estimate, type DeliveryDesign } from "../lib/delivery-design";

const ICON: Record<string, string> = { truck: "🚚", clock: "⏱", box: "📦" };

export function DeliveryPreview({ config: c, offsetMinutes, country }: { config: DeliveryDesign; offsetMinutes: number; country: string }) {
  // The clock starts in the browser (the server's time would not match on hydration).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <div style={{ padding: 24 }} />;
  const e = estimate(c.rules, new Date(now + offsetMinutes * 60_000), country);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const mins = Math.max(0, Math.ceil(e.msLeft / 60_000));
  const left = `${Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ` : ""}${mins % 60}m`;
  const dates = fmt(e.from) === fmt(e.to) ? fmt(e.from) : c.text.range.replace("{from}", fmt(e.from)).replace("{to}", fmt(e.to));
  const parts = c.text.line.split(/(\{countdown\}|\{arrives\})/);
  const piece = (tpl: string, key: string, value: string, cls?: string) =>
    tpl.split(key).flatMap((s, i, a) => (i < a.length - 1 ? [s, <b key={i} className={cls}>{value}</b>] : [s]));
  return (
    <div style={{ display: "grid", gap: 10, padding: 24, maxWidth: 440 }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>Classic tee</div>
      <div>EGP 450.00</div>
      <button type="button" style={{ minHeight: 44, border: 0, borderRadius: 999, background: "#121212", color: "#fff", font: "inherit", fontWeight: 600 }}>
        Add to cart
      </button>
      <div className={deliveryClass(c)} style={deliveryVars(c) as CSSProperties}>
        {c.look.icon !== "none" ? <span className="ucs-dl__icon" style={{ fontSize: "var(--ucs-dl-ic, 20px)" }}>{ICON[c.look.icon]}</span> : null}
        <p className="ucs-dl__text">
          {parts.map((p, i) =>
            p === "{countdown}" ? (e.today || !c.text.hideAfterCutoff ? <span key={i}>{piece(c.text.countdown, "{time}", left, "ucs-dl__time")}</span> : null) : p === "{arrives}" ? <span key={i}>{piece(c.text.arrives, "{dates}", dates)}</span> : p,
          )}
        </p>
      </div>
    </div>
  );
}
