/**
 * What "Check against orders" does to the Verified buyer tick. A found order ticks it. Nothing found unticks it
 * again only if an earlier check in this editing session ticked it (`byCheck`); a tick the merchant made by hand,
 * or one that was saved before, is never removed.
 */
export type VerifiedState = { verified: boolean; byCheck: boolean };
export type VerifiedResult = VerifiedState & { unticked: boolean };

export function applyOrderCheck(state: VerifiedState, found: boolean): VerifiedResult {
  if (found) return { verified: true, byCheck: state.verified ? state.byCheck : true, unticked: false };
  if (state.verified && state.byCheck) return { verified: false, byCheck: false, unticked: true };
  return { ...state, unticked: false };
}
