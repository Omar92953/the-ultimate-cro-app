/**
 * Live preview of the countdown bar: same markup and stylesheet as the storefront
 * (ucs-countdown.js builds the same structure), ticking every second.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { countdownBarClasses, countdownBarVars, type CountdownBarConfig } from "../lib/designs";

function deadline(c: CountdownBarConfig, now: number) {
  const t = c.timer;
  if (t.mode === "evergreen") return now + t.hours * 3600000 - 1000;
  if (t.mode === "daily") {
    const [h, m] = t.cutoff.split(":").map(Number);
    const d = new Date(now);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.getTime() <= now ? d.getTime() + 86400000 : d.getTime();
  }
  return new Date(t.end).getTime();
}

export function CountdownBarPreview({ config: c }: { config: CountdownBarConfig }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const t = c.timer;
  const left = Math.max(0, deadline(c, now) - now);
  const s = Math.floor(left / 1000);
  const v: Record<string, number> = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
  const units = t.showDays ? ["d", "h", "m", "s"] : ["h", "m", "s"];
  if (!t.showDays) v.h = Math.floor(s / 3600);
  const ended = left <= 0 && t.mode === "fixed";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div
      className={`ucs ucs-cd-host ucs-cdb is-ready ucs-cdb--top${c.layout.slim ? " ucs-cdb--slim" : ""}${countdownBarClasses(c)}`}
      style={{ ...(countdownBarVars(c) as CSSProperties), position: "relative" }}
    >
      <div className="ucs-cdb__inner">
        {c.text.show && c.text.value ? <span className="ucs-cdb__text">{c.text.value}</span> : null}
        {ended && t.ended === "message" ? (
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
        )}
        {c.button.show && c.button.text ? (
          <span className="ucs-btn ucs-cdb__btn" role="presentation">
            {c.button.text}
          </span>
        ) : null}
        {c.layout.dismissible ? (
          <span className="ucs-cdb__close" aria-hidden="true">
            <span className="ucs-i ucs-i--close" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
