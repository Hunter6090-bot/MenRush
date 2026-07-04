interface DistancePillProps {
  km: number;
  label?: string;
  className?: string;
}

/** Distance badge with pin icon — no emoji. */
export function DistancePill({ km, label, className = '' }: DistancePillProps) {
  const display = label || (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-nn-bg/60 backdrop-blur-md border border-nn-border text-nn-text text-[11px] font-medium ${className}`}
    >
      <PinIcon className="text-nn-copper shrink-0" />
      {display}
    </span>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width={10} height={10} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z" />
    </svg>
  );
}
