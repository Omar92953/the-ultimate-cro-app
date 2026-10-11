/**
 * Saving on every editor, the Shopify way: while there are unsaved changes the admin's contextual
 * save bar shows Save / Discard, and leaving the page (menu, links, Style 1→2) asks first.
 * With nothing changed there is no Save button — except on a page that was never saved, which
 * gets a plain "Save" so the merchant can put the standard look live.
 *
 *   <SaveControls dirty={changed(cfg, data.config)} saving={busy} onSave={save} onDiscard={() => setCfg(data.config)} />
 *
 * Put it directly inside <s-page> (its Save button uses the page's primary-action slot).
 */
import { useEffect, useId, useRef } from "react";
import { useBlocker, useNavigate } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { Button } from "./fields";

/** Do two saved shapes differ? (Configs are plain JSON.) */
export const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export function SaveControls(props: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** false when the page has never been saved: shows a plain Save button while nothing changed. */
  saved?: boolean;
  /** Label of that button (e.g. "Create in Shopify"). */
  label?: string;
  /** true while the page itself moves on (a save or delete in flight, or the redirect after creating). */
  allowLeave?: boolean;
}) {
  const id = `save-${useId().replace(/:/g, "")}`;
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const leaving = useRef(false);

  // In-app navigation with unsaved changes: Shopify's own "Leave page?" dialog, then go.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      props.dirty && !props.allowLeave && !leaving.current && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const to = blocker.location;
    blocker.reset();
    const confirm = shopify.saveBar?.leaveConfirmation?.();
    if (!confirm) return;
    confirm.then(() => {
      leaving.current = true;
      navigate(`${to.pathname}${to.search}${to.hash}`);
    });
  }, [blocker, navigate, shopify]);
  // A new page (or the same page after Save) starts clean.
  useEffect(() => {
    if (!props.dirty) leaving.current = false;
  }, [props.dirty]);

  // App Bridge reads these attributes on the save bar's buttons.
  const primary = { variant: "primary", ...(props.saving ? { loading: "" } : {}) } as object;
  return (
    <>
      <SaveBar id={id} open={props.dirty}>
        <button {...primary} onClick={props.onSave}>
          Save
        </button>
        <button onClick={props.onDiscard}>Discard</button>
      </SaveBar>
      {!props.dirty && props.saved === false ? (
        <Button slot="primary-action" variant="primary" loading={props.saving} onClick={props.onSave}>
          {props.label ?? "Save"}
        </Button>
      ) : null}
    </>
  );
}
