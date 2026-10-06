import { DEAL_KINDS, DEAL_TYPES } from "../lib/deals";
import { Tabs } from "./ui";

/** Tabs across all bundle types: mix & match (the bundle builder) and the four deal types. */
export function BundleTabs() {
  return <Tabs items={[{ label: "Mix & match", to: "/app/bundles" }, ...DEAL_KINDS.map((k) => ({ label: DEAL_TYPES[k].title, to: `/app/deals/${k}` }))]} />;
}
