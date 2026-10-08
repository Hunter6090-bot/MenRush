/**
 * Nearby Grid ↔ Map control (Brand lock 31 Aug 2026).
 * Label is the destination view only — never append Mode.
 * Pete lock (8 Oct 2026): one control swaps the whole screen; 44px tap target.
 */
import { IconGrid, IconMapPin } from './icons';
export type NearbyView = 'grid' | 'map';

const NEARBY_VIEW_KEY = 'menrush_nearby_view';

export function readNearbyView(): NearbyView {
  try {
    const raw = localStorage.getItem(NEARBY_VIEW_KEY);
    if (raw === 'grid' || raw === 'map') return raw;
  } catch {
    /* ignore */
  }
  return 'map';
}

export function writeNearbyView(view: NearbyView): void {
  try {
    localStorage.setItem(NEARBY_VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}

export function NearbyMapGridToggle({
  view,
  onChange,
}: {
  view: NearbyView;
  onChange: (next: NearbyView) => void;
}) {
  const next: NearbyView = view === 'grid' ? 'map' : 'grid';
  const label = next === 'map' ? 'Map' : 'Grid';
  const Icon = next === 'map' ? IconMapPin : IconGrid;
  return (
    <button
      type="button"
      data-testid="nearby-map-grid-toggle"
      aria-label={next === 'map' ? 'Show Map' : 'Show Grid'}
      title={label}
      onClick={() => onChange(next)}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.12)] px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-[#E0A14A] transition-colors hover:bg-[rgba(196,131,42,0.22)]"
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}
