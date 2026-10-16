/**
 * The top of a style editor that was opened for one offer (?design=N&offer=handle): which offer it is
 * and that its style belongs to it alone. Without ?offer the page is the group's default style.
 */
import { useEffect } from "react";
import { useFetcher, useSearchParams } from "react-router";

/** The offer this style editor was opened for (its handle), or null for the group's default style. */
export function useStyledOffer() {
  const [params] = useSearchParams();
  return params.get("offer");
}

export function OfferStyleBanner({ group, title }: { group: "upsell" | "cross_sell" | "bundles"; title: string }) {
  const offer = useStyledOffer();
  const list = useFetcher<{ offers: { handle: string; name: string }[] }>();
  useEffect(() => {
    if (offer) list.load(`/app/styles/${group}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per offer
  }, [offer, group]);
  if (!offer) return null;
  const name = list.data?.offers.find((o) => o.handle === offer)?.name;
  return (
    <s-banner tone="info" heading={name ? `You are styling “${name}”` : "You are styling one offer"}>
      <s-stack gap="small-200">
        <s-text>This style belongs to this offer only. Your other {title.toLowerCase()} offers keep their own style or the default one.</s-text>
        <s-link href={`/app/styles/${group}`}>Choose another offer</s-link>
      </s-stack>
    </s-banner>
  );
}
