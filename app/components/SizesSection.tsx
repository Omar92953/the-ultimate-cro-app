/** The "Sizes" part of a design page's Style tab: the same in every section (see lib/sizes.ts). */
import type { SizeSpec, Sizes } from "../lib/sizes";
import { NumberField, Switch } from "./fields";

export function SizesSection({ specs, value, onChange, note }: { specs: SizeSpec[]; value: Sizes; onChange: (v: Sizes) => void; note?: string }) {
  return (
    <s-section heading="Sizes">
      <s-stack gap="base">
        <Switch label="Choose my own sizes" details="Off: sizes that suit the layout and your theme." checked={value.own} onValue={(own) => onChange({ ...value, own })} />
        {value.own ? (
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            {specs.map((s) => (
              <NumberField key={s.key} label={s.label} suffix={s.unit ?? "px"} min={s.min} max={s.max} step={1} value={value.v[s.key] ?? s.def} onValue={(n) => onChange({ ...value, v: { ...value.v, [s.key]: n } })} />
            ))}
          </s-grid>
        ) : null}
        {note ? <s-text color="subdued">{note}</s-text> : null}
      </s-stack>
    </s-section>
  );
}
