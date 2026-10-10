/**
 * Remembers slow Admin API reads for a few seconds per shop (theme styles, which blocks are placed,
 * Home's overview), so moving around the app doesn't repeat them. Anything the shop saves through
 * the app (any non-GET request) forgets that shop's entries at once, so pages never show old data
 * after a save. A failed read is not remembered.
 */
const store = new Map<string, { at: number; value: Promise<unknown> }>();

export function remember<T>(shop: string, name: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const key = `${shop}|${name}`;
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
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
