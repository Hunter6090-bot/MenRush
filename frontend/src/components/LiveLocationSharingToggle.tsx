interface LiveLocationSharingToggleProps {
  enabled: boolean;
  onToggle: (next: boolean) => void | Promise<void>;
  compact?: boolean;
}

export function LiveLocationSharingToggle({
  enabled,
  onToggle,
  compact = false,
}: LiveLocationSharingToggleProps) {
  return (
    <div
      className={
        compact
          ? 'flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/70 px-3 py-2.5'
          : 'rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4'
      }
      data-testid="live-location-sharing-toggle"
    >
      <div className={compact ? 'min-w-0 flex-1' : undefined}>
        <p className={`font-semibold text-[var(--cream)] ${compact ? 'text-[13px]' : 'text-sm'}`}>
          Exact live pin with matches only
        </p>
        <p className={`mt-1 text-[var(--cream-muted)] ${compact ? 'text-[11px] leading-snug' : 'text-xs'}`}>
          {enabled
            ? 'Separate from Nearby. Nearby uses bucketed distance — not this exact pin. Slide off to pause live sharing with matches.'
            : 'Paused. Nearby still works with private GPS + approximate distance. Slide on only if you want matches to see your live pin.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onToggle(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
          enabled ? 'bg-[var(--copper)]' : 'bg-[var(--border-default)]'
        }`}
        aria-pressed={enabled}
        aria-label="Toggle live location sharing with matches"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}