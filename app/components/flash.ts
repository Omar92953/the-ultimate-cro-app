/**
 * "Which row is this?": when the merchant edits or switches a tier, product or step in an editor,
 * the matching row of the live preview gets an outline for 1.5 seconds.
 * `const [flashed, flash] = useFlash()`; call `flash("tier-1")` on a change and give the preview
 * `highlight={flashed}`; the preview wraps a row with `flashStyle(highlight === "tier-1")`.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

export function useFlash(ms = 1500) {
  const [key, setKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const flash = useCallback(
    (k: string) => {
      clearTimeout(timer.current);
      setKey(k);
      timer.current = setTimeout(() => setKey(null), ms);
    },
    [ms],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return [key, flash] as const;
}

export const flashStyle = (on: boolean): CSSProperties | undefined =>
  on ? { outline: "2px solid #005bd3", outlineOffset: 2, borderRadius: 8, transition: "outline-color 0.2s" } : undefined;
