/**
 * Delete at the bottom of an editor: a Delete button that opens an s-modal "Delete this offer?"
 * (Delete / Keep). window.confirm does not work inside the embedded admin, and the title bar slot is
 * easy to miss, so every editor uses this. The caller submits `intent=delete` in `onDelete`.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useSearchParams } from "react-router";
import { Button } from "./fields";

export function DeleteOffer({ heading = "Delete this offer?", children, busy, onDelete, label = "Delete" }: { heading?: string; children?: ReactNode; busy?: boolean; onDelete: () => void; label?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Polaris modal methods are not in the React types
  const modal = useRef<any>(null);
  return (
    <s-section heading="Delete">
      <s-stack gap="small-200">
        <s-text color="subdued">{label === "Delete" ? "This cannot be undone." : "Remove it from your store."}</s-text>
        <s-stack direction="inline">
          <Button tone="critical" icon="delete" disabled={busy} onClick={() => modal.current?.showOverlay?.()}>
            {label}
          </Button>
        </s-stack>
      </s-stack>
      <s-modal ref={modal} id="delete-offer-modal" heading={heading}>
        {children ?? <s-paragraph>This cannot be undone.</s-paragraph>}
        <Button
          slot="primary-action"
          variant="primary"
          tone="critical"
          loading={busy}
          onClick={() => {
            onDelete();
            modal.current?.hideOverlay?.();
          }}
        >
          Delete
        </Button>
        <Button slot="secondary-actions" onClick={() => modal.current?.hideOverlay?.()}>
          Keep
        </Button>
      </s-modal>
    </s-section>
  );
}

/**
 * List pages: after a delete the editor redirects here with ?deleted=ok or ?deleted=warn. "warn" means
 * the offer is gone but the follow-up (updating the checkout discounts) failed; saving any offer fixes it.
 */
export function DeletedToast() {
  const [params, setParams] = useSearchParams();
  const shopify = useAppBridge();
  const deleted = params.get("deleted");
  useEffect(() => {
    if (!deleted) return;
    if (deleted === "warn") shopify.toast.show("Deleted, but the checkout discounts could not be updated. Save any offer to try again.", { isError: true, duration: 8000 });
    else shopify.toast.show("Deleted");
    const next = new URLSearchParams(params);
    next.delete("deleted");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per redirect
  }, [deleted]);
  return null;
}
