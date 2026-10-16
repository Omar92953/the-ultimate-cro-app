/**
 * Remembers slow Admin API reads per shop (theme styles, which blocks are placed,
 * Home's overview), so moving around the app doesn't repeat them. Anything the shop saves through
 * the app (any non-GET request) forgets that shop's entries at once, so pages never show old data
 * after a save. A failed read is not remembered.
 */
const store = new Map<string, { at: number; value: Promise<unknown>; refreshing?: boolean }>();

/**
 * `ttlMs`: how long a read counts as fresh. `staleMs` (optional): for that long after it, the old
 * value is still answered at once while a fresh read runs in the background for the next visit —
 * pages stay fast and catch up one visit later (theme changes made outside the app, for example).
 */
export function remember<T>(shop: string, name: string, ttlMs: number, load: () => Promise<T>, staleMs = 0): Promise<T> {
  const key = `${shop}|${name}`;
  const hit = store.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < ttlMs) return hit.value as Promise<T>;
  if (hit && age < ttlMs + staleMs) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      const fresh = load();
      fresh.then(
        () => store.set(key, { at: Date.now(), value: fresh }),
        () => (hit.refreshing = false),
      );
    }
    return hit.value as Promise<T>;
  }
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => store.delete(key));
  if (store.size > 1000) store.delete(store.keys().next().value!);
  return value;
}

/** Store a value that was just read fresh, so the next page uses it instead of reading again. */
export function prime<T>(shop: string, name: string, value: T) {
  store.set(`${shop}|${name}`, { at: Date.now(), value: Promise.resolve(value) });
}

/**
 * Forget what is remembered for this shop: everything, or only the entries whose name starts with
 * one of `names` (e.g. ["hub", "home"]). Which names a save clears: `namesToForget` below.
 */
export function forgetShop(shop: string, names?: string[]) {
  for (const key of store.keys()) {
    if (!key.startsWith(`${shop}|`)) continue;
    if (!names || names.some((n) => key.slice(shop.length + 1).startsWith(n))) store.delete(key);
  }
}

/**
 * What a save (a non-GET request to this page) makes old. Unknown pages clear everything, so a page
 * never shows old data after a save; known ones clear only what they can change:
 *   "See on store" drafts      nothing (a draft changes no page of the app)
 *   offers, deals, bundles     the overview counts (hub, home) and the bundle previews
 *   designs, pages, sections   the overview's "saved" flags and counts (hub, home)
 * The theme (status, style), the plan and product pictures are left alone: a save in the app does
 * not change them (plan changes clear the plan themselves).
 */
export function namesToForget(pathname: string, intent?: string | null): string[] | undefined {
  if (intent === "draft") return [];
  if (/^\/app\/(offers|deals|bundles|kits|checkout\/after-purchase)(\/|$)/.test(pathname)) return ["hub", "home", "bundlepreview"];
  if (/^\/app\/(designs|pages|sections|videos|stock|returns|boosters)(\/|$)/.test(pathname)) return ["hub", "home"];
  return undefined;
}
