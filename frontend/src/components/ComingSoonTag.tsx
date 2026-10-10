/**
 * Small muted "Coming soon" tag (Brand, 10 Oct 2026): cream outline on the dark
 * card, never copper, so it never reads as something you can use. 15px.
 * Only for board items that are not built yet. Remove the tag when the feature is live.
 */
export const COMING_SOON_LABEL = 'Coming soon';

export function ComingSoonTag({ className = '' }: { className?: string }) {
  return (
    <span
      data-testid="coming-soon-tag"
      className={`inline-flex shrink-0 items-center rounded-full border border-[var(--cream-muted)] px-2.5 py-0.5 text-[15px] font-semibold leading-tight text-[var(--cream-muted)] ${className}`.trim()}
    >
      {COMING_SOON_LABEL}
    </span>
  );
}
