/** The two setup steps that depend on the theme (Home's setup guide), from the theme scan. */
export const EMBED_KEYS = ["boosters", "drawer", "announcements", "quick_add", "wishlist"] as const;

export function themeSteps(installed: Record<string, boolean> | null | undefined) {
  return {
    embed: installed ? EMBED_KEYS.some((k) => installed[k]) : false,
    // A block (offers, reviews…) placed in the theme, or the embed when offers run from it.
    place: installed ? Object.entries(installed).some(([k, on]) => on && !(EMBED_KEYS as readonly string[]).includes(k)) : false,
  };
}
