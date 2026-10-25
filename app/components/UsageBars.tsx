/**
 * This month's use of the plan's limits (live tracked shipments, loyalty orders, loyalty emails), as bars that warn
 * at 80% and at the limit, each with its "Allow extra" switch (Omar, 2026-10-22: extra is off until the store turns
 * it on). `only`: the limits this page is about. `warnOnly`: show nothing until a limit is at 80% (the Home page).
 */
import { useEffect } from "react";
import { useFetcher } from "react-router";
import type { MeterKey } from "../lib/plans";
import type { MeterUsage } from "../lib/usage.server";
import { Switch } from "./fields";

const pct = (m: MeterUsage) => Math.min(100, Math.round((m.used / m.limit) * 100));

export function UsageBars({ only, warnOnly = false }: { only?: MeterKey[]; warnOnly?: boolean }) {
  const data = useFetcher<{ meters: MeterUsage[] }>();
  const save = useFetcher();
  useEffect(() => {
    if (data.state === "idle" && !data.data) data.load("/app/usage");
  }, [data]);
  useEffect(() => {
    if (save.state === "idle" && save.data) data.load("/app/usage");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.state, save.data]);
  const meters = (data.data?.meters ?? []).filter((m) => !only || only.includes(m.meter)).filter((m) => !warnOnly || pct(m) >= 80);
  if (!meters.length) return null;
  return (
    <s-stack gap="base">
      {meters.map((m) => {
        const p = pct(m);
        const full = m.used >= m.limit;
        const color = full && !m.extra ? "#c5280c" : p >= 80 ? "#b28500" : "#2e7d32";
        const pending = save.state !== "idle" && save.formData?.get("meter") === m.meter;
        const on = pending ? save.formData?.get("on") === "true" : m.extra;
        return (
          <s-box key={m.meter} padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text type="strong">{m.title}</s-text>
                <s-text color={full ? undefined : "subdued"}>{`${m.used.toLocaleString()} of ${m.limit.toLocaleString()} this month`}</s-text>
              </s-stack>
              <div role="progressbar" aria-label={m.title} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 999, background: "#e8e8e8", overflow: "hidden" }}>
                <div style={{ width: `${p}%`, height: "100%", background: color }} />
              </div>
              {full && !m.extra ? <s-text tone="critical">{`Limit reached. ${m.atLimit}${m.yearly ? "" : " Allow extra to keep going."}`}</s-text> : p >= 80 && !m.extra ? <s-text tone="warning">{`Almost at your limit. ${m.atLimit.replace("until next month", "once it is reached")}`}</s-text> : null}
              {m.over ? <s-text color="subdued">{`${m.over.toLocaleString()} extra ${m.unit} this month: $${((m.over / m.per) * m.price).toFixed(2)} on your next Shopify bill.`}</s-text> : null}
              {m.yearly ? (
                <s-text color="subdued">{`Extra ${m.unit} ($${m.price} for every ${m.per.toLocaleString()} more) are on monthly billing. Your plan is billed yearly, so the limit stops for the month.`}</s-text>
              ) : (
                <Switch label={`Allow extra: $${m.price} for every ${m.per.toLocaleString()} more ${m.unit}`} details="Off: nothing is charged and the limit stops for the month. On: it keeps going and the extra is added to your Shopify bill." checked={on} onValue={(v) => save.submit({ meter: m.meter, on: String(v) }, { method: "post", action: "/app/usage" })} />
              )}
            </s-stack>
          </s-box>
        );
      })}
    </s-stack>
  );
}
