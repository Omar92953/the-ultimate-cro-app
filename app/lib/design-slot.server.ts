/**
 * Several designs per section ("Design 1", "Design 2"… up to MAX_DESIGNS). Design 1 keeps the old
 * handles ("faq", "faq_draft", "faq_editor"); design N uses "faq_N", "faq_N_draft", "faq_N_editor".
 * The page address says which one is open (?design=N); `slottedRoute` puts that in an async context
 * for the request, and designs.server.ts maps every handle through `slotted()`. Only the section's
 * own handles change (`bases`), so a page that also reads another design still gets the right one.
 * Each theme block has a "Design" setting (1–5) and falls back to design 1 when N isn't made yet.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export const MAX_DESIGNS = 5;

type Ctx = { bases: string[]; slot: number; copy: boolean };
const store = new AsyncLocalStorage<Ctx>();

export const slotOf = (request: Request) => {
  const n = Number(new URL(request.url).searchParams.get("design"));
  return Number.isInteger(n) && n >= 1 && n <= MAX_DESIGNS ? n : 1;
};

/** "faq_editor" → "faq_2_editor" while design 2 of "faq" is open (other handles unchanged). */
export function slotted(handle: string): string {
  const ctx = store.getStore();
  if (!ctx || ctx.slot <= 1) return handle;
  const m = /^(.*?)(_editor|_draft)?$/.exec(handle)!;
  return ctx.bases.includes(m[1]) ? `${m[1]}_${ctx.slot}${m[2] ?? ""}` : handle;
}

/** A new design that isn't saved yet starts as a copy of design 1 (?copy=1). */
export const copyingFromFirst = () => {
  const ctx = store.getStore();
  return !!ctx && ctx.slot > 1 && ctx.copy;
};

/** Wraps a loader or action so the design chosen in the address applies to it. */
export function slottedRoute<A extends { request: Request }, R>(bases: string[], fn: (args: A) => Promise<R>) {
  return (args: A) => {
    const url = new URL(args.request.url);
    return store.run({ bases, slot: slotOf(args.request), copy: url.searchParams.get("copy") === "1" }, () => fn(args));
  };
}

/** Runs `fn` as if design `slot` of these sections was open (for work that spans several designs). */
export function inSlot<T>(bases: string[], slot: number, fn: () => Promise<T>) {
  return store.run({ bases, slot, copy: false }, fn);
}
