/** A Pro-only part of a page on a lower plan: what it is, and that settings are kept for an upgrade. */
export function ProNote({ text }: { text: string }) {
  return (
    <s-banner tone="info" heading="On the Pro plan">
      <s-paragraph>{text}</s-paragraph>
      <s-link href="/app/plans">See the plans</s-link>
    </s-banner>
  );
}
