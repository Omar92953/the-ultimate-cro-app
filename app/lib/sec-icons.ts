/**
 * Line icons for the CRO sections (benefits, how it works, guarantee). Drawn on a 24 x 24 grid with
 * stroke="currentColor"; the storefront gets the inner SVG of the chosen icon, so it needs no icon file.
 * From Feather icons (MIT, see THIRD_PARTY_NOTICES.md). Shared by client and server.
 */
export const SEC_ICONS = {
  truck: { label: "Delivery truck", svg: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
  returns: { label: "Returns arrow", svg: '<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>' },
  shield: { label: "Shield", svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  lock: { label: "Lock", svg: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
  star: { label: "Star", svg: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>' },
  heart: { label: "Heart", svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>' },
  gift: { label: "Gift", svg: '<path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>' },
  clock: { label: "Clock", svg: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>' },
  chat: { label: "Chat", svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  check: { label: "Tick in a circle", svg: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>' },
  card: { label: "Payment card", svg: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>' },
  globe: { label: "Globe", svg: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
  leaf: { label: "Leaf", svg: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>' },
  award: { label: "Award", svg: '<circle cx="12" cy="8" r="7"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/>' },
  box: { label: "Box", svg: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>' },
  phone: { label: "Phone", svg: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>' },
  tag: { label: "Price tag", svg: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>' },
  smile: { label: "Smile", svg: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>' },
  zap: { label: "Lightning", svg: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>' },
  repeat: { label: "Refresh", svg: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>' },
  drop: { label: "Drop", svg: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>' },
  users: { label: "People", svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
  bag: { label: "Shopping bag", svg: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
  pointer: { label: "Click", svg: '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51z"/>' },
  thumb: { label: "Thumbs up", svg: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>' },
} as const;

export type SecIcon = keyof typeof SEC_ICONS;
export const SEC_ICON_KEYS = Object.keys(SEC_ICONS) as SecIcon[];
export const isSecIcon = (v: unknown): v is SecIcon => typeof v === "string" && v in SEC_ICONS;
export const iconSvg = (k: SecIcon | "") => (k ? SEC_ICONS[k].svg : "");
