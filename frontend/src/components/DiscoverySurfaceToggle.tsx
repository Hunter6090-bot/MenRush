import { Link } from 'react-router-dom';
import { ROUTE_LABELS } from '../lib/routeLabels';

type DiscoverySurface = 'map' | 'community';

/**
 * Shared MAP | COMMUNITY chrome — identical on phone and desktop.
 * Map lives at /discover; Community at /stream. Never mix Community under the map.
 */
export function DiscoverySurfaceToggle({ active }: { active: DiscoverySurface }) {
  const pill = (selected: boolean) =>
    selected
      ? {
          background: 'var(--copper)',
          color: 'var(--bg-primary)',
        }
      : {
          color: 'var(--cream-soft)',
        };

  return (
    <div
      className="flex items-center overflow-hidden rounded-full border bg-[var(--bg-elevated)]/85 backdrop-blur-sm"
      style={{ borderColor: 'var(--border-default)' }}
      role="group"
      aria-label="Discovery surface"
      data-testid="discovery-surface-toggle"
    >
      {active === 'map' ? (
        <span
          className="px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
          style={pill(true)}
          aria-current="page"
        >
          {ROUTE_LABELS.map}
        </span>
      ) : (
        <Link
          to="/discover"
          className="px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition-colors hover:text-[var(--copper)]"
          style={pill(false)}
          aria-label={`Switch to ${ROUTE_LABELS.map}`}
          data-testid="discover-map-toggle"
        >
          {ROUTE_LABELS.map}
        </Link>
      )}
      {active === 'community' ? (
        <span
          className="px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
          style={pill(true)}
          aria-current="page"
        >
          {ROUTE_LABELS.community}
        </span>
      ) : (
        <Link
          to="/stream"
          className="px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition-colors hover:text-[var(--copper)]"
          style={pill(false)}
          aria-label={`Switch to ${ROUTE_LABELS.community}`}
          data-testid="discover-community-toggle"
        >
          {ROUTE_LABELS.community}
        </Link>
      )}
    </div>
  );
}
