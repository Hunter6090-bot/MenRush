import { Link } from 'react-router-dom';

interface DiscreetMediaProps {
  blur: boolean;
  children: React.ReactNode;
  className?: string;
  label?: string;
}

/** Soft blur on photos/videos when the server says the viewer is not Premium. */
export function DiscreetMedia({
  blur,
  children,
  className = '',
  label = 'Unlock with Premium',
}: DiscreetMediaProps) {
  if (!blur) return <>{children}</>;

  return (
    <div className={`relative overflow-hidden ${className}`} data-testid="discreet-media-blur">
      <div className="pointer-events-none select-none blur-md scale-105" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35">
        <Link
          to="/premium"
          className="rounded-full border border-[rgba(196,131,42,0.55)] bg-[rgba(13,10,6,0.72)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#E0A14A]"
        >
          {label}
        </Link>
      </div>
    </div>
  );
}
