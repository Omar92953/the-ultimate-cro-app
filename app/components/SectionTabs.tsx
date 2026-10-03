import { SECTIONS, SECTION_KINDS } from "../lib/sections";
import { Tabs } from "./ui";

/** Tabs across the store-section lists (Reviews, FAQ, Logos, Announcements). */
export function SectionTabs() {
  return <Tabs items={SECTION_KINDS.map((k) => ({ label: SECTIONS[k].title, to: `/app/sections/${k}` }))} />;
}
