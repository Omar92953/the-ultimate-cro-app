/**
 * Server timing per loader: how long a page spent on each kind of work, logged as one line per
 * request, e.g. `[timing] app.storefront 1240ms auth=210 plan=0 hub=820 theme=640`.
 * Work that runs side by side is counted by the time spent waiting on each part, so the parts can
 * add up to more than the total. Wrap a loader with `timedLoader(name, fn)` and the pieces with
 * `timed(label, fn)`; outside a wrapped loader `timed` just runs `fn`. Set CRO_TIMING=off to silence.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage<Record<string, number>>();

export function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const marks = store.getStore();
  if (!marks) return fn();
  const start = performance.now();
  const done = () => {
    marks[label] = Math.round((marks[label] ?? 0) + performance.now() - start);
  };
  return fn().then(
    (v) => (done(), v),
    (e) => (done(), Promise.reject(e)),
  );
}

export function timedLoader<A, R>(name: string, fn: (args: A) => Promise<R>) {
  return async (args: A): Promise<R> => {
    if (process.env.CRO_TIMING === "off") return fn(args);
    const marks: Record<string, number> = {};
    const start = performance.now();
    try {
      return await store.run(marks, () => fn(args));
    } finally {
      const parts = ["auth", "plan", "hub", "theme", ...Object.keys(marks).filter((k) => !["auth", "plan", "hub", "theme"].includes(k))].map((k) => `${k}=${marks[k] ?? 0}`).join(" ");
      console.info(`[timing] ${name} ${Math.round(performance.now() - start)}ms ${parts}`);
    }
  };
}
