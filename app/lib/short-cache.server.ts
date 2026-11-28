/**
 * Remembers slow Admin API reads per shop (theme styles, which blocks are placed,
 * Home's overview), so moving around the app doesn't repeat them. Anything the shop saves through
 * the app (any non-GET request) forgets that shop's entries at once, so pages never show old data
 * after a save. A failed read is not remembered.
 */
type Entry = {
  at: number;
  value: Promise<unknown>;
  /** The value has arrived (a read still running has nothing to show yet). */
  settled?: boolean;
  /** Something changed since this read (a new order): the next visit reads again. */
  old?: boolean;
  /** Counts how often the entry was marked old, so a read started before a new order can't hide it. */
  gen?: number;
  refreshing?: boolean;
  next?: Promise<unknown>;
};
const store = new Map<string, Entry>();

function put(key: string, entry: Entry) {
  store.set(key, entry);
  entry.value.then(() => (entry.settled = true), () => {});
  if (store.size > 1000) store.delete(store.keys().next().value!);
}

/**
 * `ttlMs`: how long a read counts as fresh. `staleMs` (optional): for that long after it, the old
 * value is still answered at once while a fresh read runs in the background for the next visit —
 * pages stay fast and catch up one visit later (theme changes made outside the app, for example).
 * An entry marked old (`markOld`) counts as expired.
 */
export function remember<T>(shop: string, name: string, ttlMs: number, load: () => Promise<T>, staleMs = 0): Promise<T> {
  const key = `${shop}|${name}`;
  const hit = store.get(key);
  const age = hit && !hit.old ? Date.now() - hit.at : Infinity;
  if (hit && age < ttlMs) return hit.value as Promise<T>;
  if (hit && age < ttlMs + staleMs) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      const fresh = load();
      fresh.then(
        () => put(key, { at: Date.now(), value: fresh }),
        () => (hit.refreshing = false),
      );
    }
    return hit.value as Promise<T>;
  }
  const value = load();
  put(key, { at: Date.now(), value });
  value.catch(() => store.get(key)?.value === value && store.delete(key));
  return value;
}

/**
 * For reads that must show changes at once but can be slow on big stores (the orders behind Home and
 * Analytics). Fresh (younger than `maxAgeMs` and nothing changed since): answered at once. Otherwise a
 * new read starts and the page waits for it up to `waitMs`; if it takes longer, the last value is
 * answered with `stale: true` and the read goes on in the background, so the page can ask again and
 * get it (Analytics reloads itself). With nothing to show yet, the page waits for the read.
 */
export async function rememberLive<T>(shop: string, name: string, maxAgeMs: number, load: () => Promise<T>, waitMs: number): Promise<{ value: T; stale: boolean }> {
  const key = `${shop}|${name}`;
  const hit = store.get(key);
  if (!hit || !hit.settled) {
    const value = await remember(shop, name, Infinity, load);
    return { value, stale: Boolean(store.get(key)?.old) };
  }
  if (!hit.old && Date.now() - hit.at < maxAgeMs) return { value: (await hit.value) as T, stale: false };
  if (!hit.refreshing) {
    hit.refreshing = true;
    const gen = hit.gen ?? 0;
    const fresh = load();
    hit.next = fresh;
    fresh.then(
      () => {
        // Marked old again while this read ran (another order): keep it old, so the next visit reads again.
        const changed = (store.get(key)?.gen ?? 0) !== gen;
        if (store.get(key) === hit) put(key, { at: Date.now(), value: fresh, old: changed, gen: changed ? hit.gen : 0 });
      },
      () => {
        hit.refreshing = false;
        hit.next = undefined;
      },
    );
  }
  const next = hit.next as Promise<T>;
  const won = await Promise.race([
    next.then((value) => ({ value }), () => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
  if (won) return { value: won.value, stale: Boolean(store.get(key)?.old) };
  return { value: (await hit.value) as T, stale: true };
}

/** Mark entries old without dropping them: the next visit reads again, and can show the last value meanwhile. */
function markOld(entry: Entry) {
  entry.old = true;
  entry.gen = (entry.gen ?? 0) + 1;
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
    const name = key.slice(shop.length + 1);
    if (names && !names.some((n) => name.startsWith(n))) continue;
    // The order reads are kept, marked old: big stores take a while to read, and the last numbers can
    // show meanwhile (rememberLive).
    const entry = store.get(key)!;
    if (ORDER_READS.some((n) => name === n) && entry.settled) markOld(entry);
    else store.delete(key);
  }
}

/** The remembered reads of the shop's orders (Home and Analytics results, loyalty analytics). */
export const ORDER_READS = ["home-results", "loyalty-analytics-orders"];

/**
 * A new order, or an item added to one (the after-purchase offer): mark the order reads old so the
 * next visit to Home or Analytics reads the orders again and shows it. `again` (ms) forgets them once
 * more after a delay, for changes Shopify applies to the order a moment later.
 */
export function forgetOrders(shop: string, again?: number) {
  forgetShop(shop, ORDER_READS);
  if (again) setTimeout(() => forgetShop(shop, ORDER_READS), again).unref?.();
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
