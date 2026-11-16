/**
 * Browser side of the free tools: reads the form, writes the results and announces the summary to
 * screen readers. The page's HTML already holds the results for the example numbers, so nothing moves
 * on load. The currency choice is remembered between the tools (only in this browser).
 */
const KEY = "crotoolbox-tools-currency";

export type CalcView = { values: Record<string, string>; summary: string };

/** Wires one calculator: `compute` gets a number reader and the currency, and returns the text for each output id. */
export function setupCalc(form: HTMLFormElement, compute: (n: (name: string) => number, currency: string) => CalcView) {
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  const n = (name: string) => {
    const el = field(name);
    if (!el || el.value.trim() === "") return NaN;
    return Number(el.value);
  };
  const select = field("currency") as HTMLSelectElement | null;
  try {
    const saved = localStorage.getItem(KEY);
    if (select && saved !== null && [...select.options].some((o) => o.value === saved)) select.value = saved;
  } catch {
    /* storage blocked: keep the default */
  }
  const summary = form.querySelector<HTMLElement>("[data-summary]");
  const live = form.querySelector<HTMLElement>("[data-live]");
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = (announce: boolean) => {
    const view = compute(n, select?.value ?? "USD");
    for (const [id, text] of Object.entries(view.values)) {
      const el = document.getElementById(id);
      if (el && el.textContent !== text) el.textContent = text;
    }
    if (summary) summary.textContent = view.summary;
    // Announce once typing pauses, not on every key.
    if (announce && live) {
      clearTimeout(timer);
      timer = setTimeout(() => (live.textContent = view.summary), 700);
    }
  };

  form.addEventListener("input", () => run(true));
  form.addEventListener("change", (e) => {
    if (e.target === select) {
      try {
        localStorage.setItem(KEY, select!.value);
      } catch {
        /* storage blocked */
      }
    }
    run(true);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run(true);
  });
  // Values the browser restored (back button) or a saved currency.
  run(false);
}
