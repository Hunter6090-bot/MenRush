import {
  RADIUS_MILE_OPTIONS,
  formatRadiusMilesLabel,
  kmToRadiusSelection,
  radiusSelectionToKm,
  type RadiusMilesSelection,
} from '../lib/discoveryFormat';
import type { ReactNode } from 'react';
import {
  RADIUS_KM_OPTIONS,
  displayRadiusValueToKm,
  formatRadiusFromKm,
  kmToDisplayRadiusValue,
} from '../lib/localeUnits';
import { useLocaleUnits } from '../hooks/useLocaleUnits';

interface RadiusMilesSelectProps {
  valueKm: number;
  onChange: (km: number) => void;
  id?: string;
  label?: string;
  className?: string;
  compact?: boolean;
}

export function RadiusMilesSelect({
  valueKm,
  onChange,
  id = 'radius-miles-select',
  label,
  className = '',
  compact = false,
}: RadiusMilesSelectProps) {
  const { unitSystem } = useLocaleUnits();
  const useMiles = unitSystem === 'imperial';
  const resolvedLabel =
    label ?? (useMiles ? 'Search radius in miles' : 'Search radius in kilometres');

  if (useMiles) {
    const selection = kmToRadiusSelection(valueKm);
    const selectValue = selection === 'all' ? 'all' : String(selection);

    const handleChange = (raw: string) => {
      const next: RadiusMilesSelection = raw === 'all' ? 'all' : Number.parseInt(raw, 10);
      onChange(radiusSelectionToKm(next));
    };

    return (
      <RadiusSelectShell
        id={id}
        label={resolvedLabel}
        className={className}
        compact={compact}
        value={selectValue}
        onChange={handleChange}
      >
        <option value="all">{formatRadiusMilesLabel('all')}</option>
        {RADIUS_MILE_OPTIONS.map((miles) => (
          <option key={miles} value={miles}>
            {formatRadiusMilesLabel(miles)}
          </option>
        ))}
      </RadiusSelectShell>
    );
  }

  const selection = kmToDisplayRadiusValue(valueKm, 'metric');
  const selectValue = selection === 'all' ? 'all' : String(selection);

  const handleChange = (raw: string) => {
    const next = raw === 'all' ? 'all' : Number.parseInt(raw, 10);
    onChange(displayRadiusValueToKm(next, 'metric'));
  };

  return (
    <RadiusSelectShell
      id={id}
      label={resolvedLabel}
      className={className}
      compact={compact}
      value={selectValue}
      onChange={handleChange}
    >
      <option value="all">All</option>
      {RADIUS_KM_OPTIONS.map((km) => (
        <option key={km} value={km}>
          {formatRadiusFromKm(km, 'metric')}
        </option>
      ))}
    </RadiusSelectShell>
  );
}

function RadiusSelectShell({
  id,
  label,
  className,
  compact,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  className: string;
  compact: boolean;
  value: string;
  onChange: (raw: string) => void;
  children: ReactNode;
}) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <div className="relative">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          data-testid="radius-miles-select"
          className={`appearance-none rounded-full border border-nn-border bg-nn-card font-bold text-nn-text transition-colors hover:border-nn-copper/40 focus:border-nn-copper/50 focus:outline-none focus:ring-2 focus:ring-nn-copper/20 ${
            compact
              ? 'h-9 min-w-[108px] pl-3 pr-8 text-[12px]'
              : 'h-10 min-w-[128px] pl-4 pr-9 text-[13px]'
          }`}
        >
          {children}
        </select>
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-nn-muted"
          aria-hidden
        >
          <ChevronDown className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </span>
      </div>
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}