/**
 * Shared layout for every design page: tabs at the top (same names everywhere), settings on the
 * left, the live preview on the right, all in a centred column with space on both sides.
 */
import type { ReactNode } from "react";
import { Segmented } from "./ui";
import ui from "./PageEditor.module.css";

export type DesignTab = "looks" | "content" | "layout" | "style" | "display";
const LABELS: Record<DesignTab, string> = { looks: "Looks", content: "Content", layout: "Layout", style: "Style", display: "Display" };

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

/** Frame around a preview, with its title ("Product page", "Home page"…) and optional tools. */
export function PreviewFrame({ title, children, tools }: { title: string; children: ReactNode; tools?: ReactNode }) {
  return (
    <div className={ui.preview}>
      <div className={ui.previewBar}>
        <span />
        <span>{title}</span>
        <span>{tools}</span>
      </div>
      <div className={ui.frame}>{children}</div>
    </div>
  );
}
