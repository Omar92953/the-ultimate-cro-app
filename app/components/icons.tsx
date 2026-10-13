/**
 * Small line icons for hub cards (20px, currentColor). Kept simple so they match Polaris icons.
 */
const svg = { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Upsell: an arrow going up. */
export const UpsellIcon = () => (
  <svg {...svg}>
    <path d="M3 14l5-5 3 3 6-6" />
    <path d="M12.5 6H17v4.5" />
  </svg>
);

/** Cross-sell: two products side by side with a plus. */
export const CrossSellIcon = () => (
  <svg {...svg}>
    <rect x="2.5" y="5" width="6" height="10" rx="1.5" />
    <rect x="11.5" y="5" width="6" height="10" rx="1.5" />
    <path d="M10 8.5v3M8.5 10h3" />
  </svg>
);

/** Bundles: a box. */
export const BundleIcon = () => (
  <svg {...svg}>
    <path d="M3 6.5L10 3l7 3.5v7L10 17l-7-3.5v-7z" />
    <path d="M3 6.5L10 10l7-3.5M10 10v7" />
  </svg>
);

/** Discounts: a price tag. */
export const DiscountIcon = () => (
  <svg {...svg}>
    <path d="M10.5 3H16a1 1 0 011 1v5.5L9.5 17 3 10.5 10.5 3z" />
    <circle cx="13.5" cy="6.5" r="1.2" />
  </svg>
);
