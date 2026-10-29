/**
 * Copies text from a click in the app. Shopify's admin runs the app in a frame where the Clipboard API is usually
 * refused, so the older select and copy runs first, inside the click; the Clipboard API is the fallback.
 * False when neither worked (the caller says to select and copy by hand).
 */
export async function copyText(text: string): Promise<boolean> {
  if (selectAndCopy(text)) return true;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function selectAndCopy(text: string) {
  if (typeof document === "undefined") return false;
  const focused = document.activeElement as HTMLElement | null;
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  Object.assign(box.style, { position: "fixed", top: "0", left: "-9999px", opacity: "0" });
  document.body.appendChild(box);
  box.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  box.remove();
  focused?.focus?.();
  return ok;
}
