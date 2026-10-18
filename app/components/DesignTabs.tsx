/**
 * Shared layout for every design page: tabs at the top (same names everywhere), settings on the
 * left, the live preview on the right, all in a centred column with space on both sides.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Segmented } from "./ui";
import ui from "./PageEditor.module.css";

/** The same three tabs on every design page: start from a template, the words and items, then how it looks (layout, colours, spacing, devices). */
export type DesignTab = "looks" | "content" | "design" | "show";
const LABELS: Record<DesignTab, string> = { looks: "Templates", content: "Content", design: "Style", show: "What to show" };

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
/** Previews are always drawn at this store width, then scaled to the column, so their shape never changes. */
const PREVIEW_WIDTH = 1000;

/**
 * Frame around a preview, with its title ("Product page", "Home page"…) and optional tools. The
 * preview is drawn at PREVIEW_WIDTH and scaled to fit the column, so it keeps the same proportions on
 * any screen (only its size changes). It stays clickable.
 */
export function PreviewFrame({ title, children, tools, width = PREVIEW_WIDTH }: { title: string; children: ReactNode; tools?: ReactNode; /** The store width it is drawn at (default: a full page). */ width?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      // Rounded, so a 1px change in the column (e.g. a scrollbar) can't start a resize loop.
      const scale = Math.min(1, Math.floor((o.clientWidth / width) * 100) / 100);
      setFit((f) => (f.scale === scale && f.height === i.offsetHeight ? f : { scale, height: i.offsetHeight }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width]);
  // Before the first measure (server render) it is drawn unscaled at the same width.
  const scaled = fit.height > 0;
  return (
    <div className={ui.preview}>
      <div className={ui.previewBar}>
        <span />
        <span>{title}</span>
        <span>{tools}</span>
      </div>
      <div className={ui.frame} ref={outer}>
        <div style={{ height: scaled ? fit.height * fit.scale : undefined, overflow: "hidden" }}>
          <div ref={inner} style={{ width, transform: `scale(${fit.scale})`, transformOrigin: "top left" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
