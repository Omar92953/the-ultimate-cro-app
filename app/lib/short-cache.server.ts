/**
 * Remembers slow, rarely-changing Admin API reads (the theme's styles, which blocks are placed)
 * for a few seconds per shop, so switching between a feature's tabs doesn't read the whole theme
 * again each time. A failed read is not remembered.
 */
const store = new Map<string, { at: number; value: Promise<unknown> }>();

export function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => store.delete(key));
  if (store.size > 500) store.delete(store.keys().next().value!);
  return value;
}
