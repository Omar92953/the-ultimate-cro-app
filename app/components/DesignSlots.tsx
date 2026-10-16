/**
 * "Style 1 · Style 2 · + New style" on a design page: a section can have several styles (designs), each
 * placed separately in the theme editor (the block's "Style" setting, id `design`). See lib/design-slot.server.ts.
 */
import { useEffect, useState } from "react";
import { useFetcher, useNavigate, useSearchParams } from "react-router";
import { Button, TextField } from "./fields";
import { UpgradeButton, usePlan } from "./Upgrade";
import { PLANS, limitOf, planAbove } from "../lib/plans";

const MAX = 5;

/** The open design (?design=N), 1 when none. */
export function useDesignSlot() {
  const [params] = useSearchParams();
  const n = Number(params.get("design"));
  return Number.isInteger(n) && n >= 1 && n <= MAX ? n : 1;
}

/** Where a design page posts its saves, so they go to the open design. */
export function useDesignAction() {
  const [params] = useSearchParams();
  const offer = params.get("offer");
  return `?design=${useDesignSlot()}${offer ? `&offer=${encodeURIComponent(offer)}` : ""}`;
}

export function DesignSlots({ base, blockName }: { base: string; blockName: string }) {
  const slot = useDesignSlot();
  const list = useFetcher<{ slots: number[]; names: Record<string, string> }>();
  const save = useFetcher<{ ok: boolean; error: string | null }>();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    list.load(`/app/design-slots?base=${base}`);
    // Reload the list after a rename or delete, and when another design is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, slot, save.data]);
  const slots = list.data?.slots ?? [1];
  const all = slots.includes(slot) ? slots : [...slots, slot].sort((a, b) => a - b);
  const names = list.data?.names ?? {};
  const label = (n: number) => names[String(n)] || `Style ${n}`;
  // The plan decides how many designs a section can have (lib/plans.ts); older ones above it stay on the store.
  const { plan } = usePlan();
  const allowed = limitOf(plan, "designsPerSection") ?? MAX;
  const next = Array.from({ length: MAX }, (_, i) => i + 1).find((n) => !all.includes(n));
  const upgradeTo = next && next > allowed ? planAbove("designsPerSection", next - 1, plan) : null;
  const go = (n: number, copy = false) => navigate(`?design=${n}${copy ? "&copy=1" : ""}`);
  const [name, setName] = useState(names[String(slot)] ?? "");
  const [shown, setShown] = useState(`${slot}:${names[String(slot)] ?? ""}`);
  if (shown !== `${slot}:${names[String(slot)] ?? ""}`) {
    setShown(`${slot}:${names[String(slot)] ?? ""}`);
    setName(names[String(slot)] ?? "");
  }

  return (
    <s-box padding="small-300" borderWidth="base" borderRadius="base">
      <s-stack gap="small-300">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {all.map((n) => (
            <Button key={n} variant={n === slot ? "primary" : "secondary"} onClick={() => go(n)}>
              {label(n)}
            </Button>
          ))}
          {next && !upgradeTo ? (
            <Button variant="tertiary" icon="plus" onClick={() => go(next, true)}>
              New style
            </Button>
          ) : null}
          {upgradeTo ? (
            <UpgradeButton variant="tertiary">{`More styles on ${PLANS[upgradeTo].name}`}</UpgradeButton>
          ) : null}
        </s-stack>
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-300" alignItems="end">
          <TextField
            label="Name of this style"
            details={`To use it, set the “${blockName}” block's Style to ${slot} in the theme editor.${slot > 1 ? " A new style starts as a copy of style 1." : ""}`}
            placeholder={`Style ${slot}`}
            value={name}
            onValue={setName}
          />
          <s-stack direction="inline" gap="small-200">
            <Button disabled={name === (names[String(slot)] ?? "")} loading={save.state !== "idle"} onClick={() => save.submit({ intent: "rename", base, slot: String(slot), name }, { method: "post", action: "/app/design-slots" })}>
              Save name
            </Button>
            {slot > 1 && slots.includes(slot) ? (
              confirming ? (
                <Button
                  tone="critical"
                  variant="primary"
                  onClick={() => {
                    setConfirming(false);
                    save.submit({ intent: "delete", base, slot: String(slot) }, { method: "post", action: "/app/design-slots" });
                    go(1);
                  }}
                >
                  Delete style {slot}
                </Button>
              ) : (
                <Button tone="critical" variant="tertiary" icon="delete" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              )
            ) : null}
          </s-stack>
        </s-grid>
        {save.data?.error ? <s-text tone="critical">{save.data.error}</s-text> : null}
      </s-stack>
    </s-box>
  );
}
