/**
 * Spot-type line icons for Out cards, the spot sheet and the cruising search.
 * Same style as the tab icons: 24px grid, 2px round stroke, currentColor, so
 * they follow the theme (copper on dark, rust on light). Replaces the emoji the
 * category rows used to carry (Brand, 10 Oct 2026).
 */
import type { ReactElement, SVGProps } from 'react';
import { IconCommunity } from './IconCommunity';

export type SpotTypeKey =
  | 'parking'
  | 'open-space'
  | 'trees'
  | 'beach'
  | 'sauna'
  | 'bar'
  | 'nightlife'
  | 'cinema'
  | 'facilities'
  | 'transit'
  | 'event'
  | 'community'
  | 'pin';

/** Map a category slug or name (server or cruising category) to an icon key. */
export function spotTypeKey(slugOrName?: string | null, name?: string | null): SpotTypeKey {
  const s = `${slugOrName ?? ''} ${name ?? ''}`.toLowerCase();
  if (/parking|lay-?by|car park|pull-in/.test(s)) return 'parking';
  if (/sauna|spa\b|bathhouse|steam/.test(s)) return 'sauna';
  if (/cinema|film/.test(s)) return 'cinema';
  if (/nightlife|club/.test(s)) return 'nightlife';
  if (/\bbars?\b|pub\b/.test(s)) return 'bar';
  if (/beach|coast|dune/.test(s)) return 'beach';
  if (/wood|forest|trail|copse/.test(s)) return 'trees';
  if (/open.?space|heath|common|park\b|parks/.test(s)) return 'open-space';
  if (/transit|station|travel/.test(s)) return 'transit';
  if (/rest|facilit|amenit/.test(s)) return 'facilities';
  if (/event|ticket/.test(s)) return 'event';
  if (/community|stream/.test(s)) return 'community';
  return 'pin';
}

type Props = Omit<SVGProps<SVGSVGElement>, 'type'> & {
  type: SpotTypeKey;
  size?: number;
};

const PATHS: Record<Exclude<SpotTypeKey, 'community'>, ReactElement> = {
  parking: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M10 17V7h3a3 3 0 010 6h-3" />
    </>
  ),
  'open-space': (
    <>
      <path d="M3 19l6-8 4 5 3-3 5 6z" />
      <circle cx="16" cy="7" r="2" />
    </>
  ),
  trees: (
    <>
      <path d="M12 3l5 7h-3l4 6H6l4-6H7z" />
      <path d="M12 16v5" />
    </>
  ),
  beach: (
    <>
      <circle cx="12" cy="9" r="3" />
      <path d="M3 17c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
    </>
  ),
  sauna: (
    <>
      <path d="M8 4c-1 1.5 1 3 0 4.5M12 4c-1 1.5 1 3 0 4.5M16 4c-1 1.5 1 3 0 4.5" />
      <path d="M4 12h16v3a5 5 0 01-5 5H9a5 5 0 01-5-5z" />
    </>
  ),
  bar: (
    <>
      <path d="M5 4h14l-7 8z" />
      <path d="M12 12v8M8 20h8" />
    </>
  ),
  nightlife: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="16" r="2" />
    </>
  ),
  cinema: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
    </>
  ),
  facilities: (
    <>
      <path d="M3 9l9-5 9 5" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
    </>
  ),
  transit: (
    <>
      <rect x="6" y="3" width="12" height="14" rx="3" />
      <path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4" />
    </>
  ),
  event: (
    <>
      <path d="M4 7h16v3a2 2 0 000 4v3H4v-3a2 2 0 000-4z" />
      <path d="M14 8v2M14 12v2M14 16v0.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.25" />
    </>
  ),
};

export function SpotTypeIcon({ type, size = 24, className, ...rest }: Props) {
  if (type === 'community') {
    return (
      <span className={className} data-spot-icon="community" aria-hidden>
        <IconCommunity size={size} />
      </span>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-spot-icon={type}
      aria-hidden
      focusable="false"
      {...rest}
    >
      {PATHS[type]}
    </svg>
  );
}
