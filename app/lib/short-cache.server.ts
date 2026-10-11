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

/** Forget everything remembered for this shop (called after every save). */
export function forgetShop(shop: string) {
  for (const key of store.keys()) if (key.startsWith(`${shop}|`)) store.delete(key);
}
