/**
 * Own sizes for the parts of a section, the same way in every section: a switch ("Choose own
 * sizes") and one number per part. Each part is a CSS variable that the storefront stylesheet reads
 * with its automatic size as the fallback, so with the switch off nothing changes.
 * Shared by client and server.
 */
import { num } from "./designs";

export type SizeSpec = { key: string; label: string; cssVar: string; min: number; max: number; def: number; unit?: "px" | "%" };
export type Sizes = { own: boolean; v: Record<string, number> };

export const defaultSizes = (specs: SizeSpec[]): Sizes => ({ own: false, v: Object.fromEntries(specs.map((s) => [s.key, s.def])) });

export function withSizes(raw: unknown, specs: SizeSpec[]): Sizes {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const v = r.v && typeof r.v === "object" ? (r.v as Record<string, unknown>) : {};
  return { own: r.own === true, v: Object.fromEntries(specs.map((s) => [s.key, num(v[s.key], s.min, s.max, s.def)])) };
}

export function sizeVars(sizes: Sizes, specs: SizeSpec[]): Record<string, string> {
  if (!sizes.own) return {};
  return Object.fromEntries(specs.map((s) => [s.cssVar, `${sizes.v[s.key] ?? s.def}${s.unit ?? "px"}`]));
}

/* Parts most sections share. */
export const SUB: SizeSpec = { key: "sub", label: "Text under heading", cssVar: "--ucs-sub", min: 10, max: 40, def: 16 };
export const BUTTON_TEXT: SizeSpec = { key: "buttonText", label: "Button text", cssVar: "--ucs-btn-fs", min: 10, max: 28, def: 15 };
export const BUTTON_HEIGHT: SizeSpec = { key: "buttonHeight", label: "Button height", cssVar: "--ucs-btn-h", min: 28, max: 72, def: 44 };
