/**
 * Shared layout for every design page: tabs at the top (same names everywhere), settings on the
 * left, the live preview on the right, all in a centred column with space on both sides.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Segmented } from "./ui";
import ui from "./PageEditor.module.css";

export type DesignTab = "looks" | "content" | "layout" | "style" | "display";
const LABELS: Record<DesignTab, string> = { looks: "Templates", content: "Content", layout: "Layout", style: "Style", display: "Display" };

export function DesignTabs({ tabs, value, onChange }: { tabs: DesignTab[]; value: DesignTab; onChange: (t: DesignTab) => void }) {
  return (
    <div className={ui.tabsBar} style={{ position: "sticky", top: 0, zIndex: 5, padding: "6px 0" }}>
      <Segmented label="Settings" value={value} options={tabs.map((t) => ({ value: t, label: LABELS[t] }))} onChange={onChange} />
    </div>
  );
}

/** Shows its settings only on the chosen tab. */
export function Pane({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <>{children}</> : null;
}

/** The narrowest width a preview is drawn at; a thinner column shows it scaled down instead. */
const MIN_PREVIEW_WIDTH = 720;

/**
 * Frame around a preview, with its title ("Product page", "Home page"…) and optional tools. The
 * preview is responsive: in a column narrower than MIN_PREVIEW_WIDTH it is drawn at that width and
 * scaled down to fit, so the store's design never gets squashed. It stays clickable.
 */
export function PreviewFrame({ title, children, tools }: { title: string; children: ReactNode; tools?: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const scale = Math.min(1, o.clientWidth / MIN_PREVIEW_WIDTH);
      setFit((f) => (f.scale === scale && f.height === i.offsetHeight ? f : { scale, height: i.offsetHeight }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);
  const scaled = fit.scale < 1;
  return (
    <div className={ui.preview}>
      <div className={ui.previewBar}>
        <span />
        <span>{title}</span>
        <span>{tools}</span>
      </div>
      <div className={ui.frame} ref={outer}>
        <div style={scaled ? { height: fit.height * fit.scale, overflow: "hidden" } : undefined}>
          <div ref={inner} style={scaled ? { width: MIN_PREVIEW_WIDTH, transform: `scale(${fit.scale})`, transformOrigin: "top left" } : undefined}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
