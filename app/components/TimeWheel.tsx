/**
 * A time picker like a phone's alarm clock: an hour wheel and a minute wheel (5 minute steps) that snap to the middle.
 * Scroll, click a number, or use the arrow keys. `value` and `onValue` are "HH:MM".
 */
import { useEffect, useRef } from "react";
import css from "./TimeWheel.module.css";

const ROW = 34;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function Wheel(props: { items: string[]; value: string; onValue: (v: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, props.items.indexOf(props.value));
  // Keep the wheel on the value (first show, Discard, a value set elsewhere).
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ROW) !== index) el.scrollTop = index * ROW;
  }, [index]);
  const pick = (i: number) => {
    const n = Math.min(props.items.length - 1, Math.max(0, i));
    ref.current?.scrollTo({ top: n * ROW, behavior: "smooth" });
    if (props.items[n] !== props.value) props.onValue(props.items[n]);
  };
  return (
    <div
      ref={ref}
      className={css.wheel}
      tabIndex={0}
      role="spinbutton"
      aria-label={props.label}
      aria-valuetext={props.value}
      aria-valuenow={index}
      aria-valuemin={0}
      aria-valuemax={props.items.length - 1}
      onScroll={() => {
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(() => {
          const i = Math.round((ref.current?.scrollTop ?? 0) / ROW);
          if (props.items[i] && props.items[i] !== props.value) props.onValue(props.items[i]);
        }, 120);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") (e.preventDefault(), pick(index + 1));
        else if (e.key === "ArrowUp") (e.preventDefault(), pick(index - 1));
      }}
    >
      <div className={css.pad} />
      {props.items.map((v, i) => (
        <button key={v} type="button" tabIndex={-1} className={`${css.item} ${i === index ? css.on : ""}`} onClick={() => pick(i)}>
          {v}
        </button>
      ))}
      <div className={css.pad} />
    </div>
  );
}

export function TimeWheel(props: { label: string; value: string; onValue: (v: string) => void }) {
  const [h = "09", m = "00"] = props.value.split(":");
  // A minute that isn't on a 5 minute step (saved before) shows on the nearest one below.
  const mm = String(Math.min(55, Math.floor(Number(m) / 5) * 5)).padStart(2, "0");
  return (
    <div className={css.field}>
      <span className={css.label}>{props.label}</span>
      <div className={css.wheels}>
        <Wheel label={`${props.label}, hour`} items={HOURS} value={h} onValue={(v) => props.onValue(`${v}:${mm}`)} />
        <span className={css.colon}>:</span>
        <Wheel label={`${props.label}, minutes`} items={MINUTES} value={mm} onValue={(v) => props.onValue(`${h}:${v}`)} />
      </div>
    </div>
  );
}
