/**
 * Live preview of the countdown bar: same markup and stylesheet as the storefront
 * (ucs-countdown.js builds the same structure), ticking every second.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { countdownBarClasses, countdownBarVars, type CountdownBarConfig } from "../lib/designs";

/** A wall-clock time in the store's zone → epoch ms (same maths as ucs-countdown.js). */
const at = (y: number, mo: number, d: number, h: number, mi: number, off: number) => Date.UTC(y, mo, d, h, mi) - off * 60000;

/** off = the shop's UTC offset in minutes: dates and cut-offs are the store's clock, not this computer's. */
function deadline(c: CountdownBarConfig, now: number, off: number) {
  const t = c.timer;
  if (t.mode === "evergreen") return now + t.hours * 3600000 - 1000;
  if (t.mode === "daily") {
    const [h, m] = t.cutoff.split(":").map(Number);
    const shop = new Date(now + off * 60000);
    const end = at(shop.getUTCFullYear(), shop.getUTCMonth(), shop.getUTCDate(), h || 0, m || 0, off);
    return end <= now ? end + 86400000 : end;
  }
  const m = /(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/.exec(t.end || "");
  return m ? at(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : 23, m[5] ? Number(m[5]) : 59, off) : 0;
}

export function CountdownBarPreview({ config: c, offset = 0 }: { config: CountdownBarConfig; offset?: number }) {
  // The clock starts after the page has loaded, so the server and the browser draw the same first frame.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const t = c.timer;
  const left = now === null ? 0 : Math.max(0, deadline(c, now, offset) - now);
  const s = Math.floor(left / 1000);
  const v: Record<string, number> = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
  const units = t.showDays ? ["d", "h", "m", "s"] : ["h", "m", "s"];
  if (!t.showDays) v.h = Math.floor(s / 3600);
  const ended = now !== null && left <= 0 && t.mode === "fixed";
  const pad = (n: number) => String(n).padStart(2, "0");
  const timer = ended && t.ended === "message" ? (
    <span className="ucs-cd__end">{t.endedText}</span>
  ) : (
    <span className={`ucs-cd ucs-cd--${t.style} is-live${v.d === 0 && t.showDays ? " is-nodays" : ""}`} role="timer">
      {units.map((u, i) => (
        <span key={u} style={{ display: "contents" }}>
          {i ? (
            <span className="ucs-cd__sep" data-sep={u} aria-hidden="true">
              :
            </span>
          ) : null}
          <span className="ucs-cd__u" data-u={u}>
            <span className="ucs-cd__n">{pad(v[u])}</span>
            {t.labels ? <span className="ucs-cd__l">{t.labelText[u as "d"]}</span> : null}
          </span>
        </span>
      ))}
    </span>
  );
  const text = c.text.show && c.text.value ? <span className="ucs-cdb__text">{c.text.value}</span> : null;
  const button =
    c.button.show && c.button.text ? (
      <span className="ucs-btn ucs-cdb__btn" role="presentation">
        {c.button.text}
      </span>
    ) : null;
  const style = { ...(countdownBarVars(c) as CSSProperties), position: "relative" as const };

  if (c.kind === "section") {
    const s = c.section;
    return (
      <div className={`ucs ucs-cd-host ucs-cdb ucs-cdk ucs-cdh ucs-cdh--${s.layout} is-ready${countdownBarClasses(c)}`} style={style}>
        <div className="ucs-wrap ucs-cdh__wrap">
          {s.heading || s.sub ? (
            <div className="ucs-cdh__text">
              {s.heading ? <h2 className="ucs-cdh__title">{s.heading}</h2> : null}
              {s.sub ? <p className="ucs-cdh__sub">{s.sub}</p> : null}
            </div>
          ) : null}
          <div className="ucs-cdh__timer">{timer}</div>
          {button}
        </div>
      </div>
    );
  }
  if (c.kind === "inline") {
    return (
      <div className={`ucs ucs-cd-host ucs-cdb ucs-cdi is-ready${countdownBarClasses(c)}`} style={style}>
        <div className="ucs-cdi__inner">
          {text}
          {timer}
          {button}
        </div>
      </div>
    );
  }
  return (
    <div className={`ucs ucs-cd-host ucs-cdb is-ready ucs-cdb--top${c.layout.slim ? " ucs-cdb--slim" : ""}${countdownBarClasses(c)}`} style={style}>
      <div className="ucs-cdb__inner">
        {text}
        {timer}
        {button}
        {c.layout.dismissible ? (
          <span className="ucs-cdb__close" aria-hidden="true">
            <span className="ucs-i ucs-i--close" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
