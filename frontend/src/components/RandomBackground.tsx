import { useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { pickPageBackground } from '../lib/menrushBackgrounds';

type RandomBackgroundProps = {
  /** Optional opacity override (e.g. auth shell ~0.3; assurance ~0.52). */
  opacity?: number;
  /** CSS brightness multiplier (default 0.95; assurance screens ~1.05–1.1). */
  brightness?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Full-bleed public/auth photo. One random image per pathname for the
 * lifetime of that page visit. Re-rolls on navigation to another page that
 * mounts this component (keyed by pathname), and on full refresh. Never on a timer.
 */
export function RandomBackground(props: RandomBackgroundProps) {
  const { pathname } = useLocation();
  // key forces a fresh mount (and a new pick) when the route changes while a
  // shared parent keeps this component in the tree.
  return <RandomBackgroundVisit key={pathname} {...props} />;
}

function RandomBackgroundVisit({
  opacity,
  brightness = 0.95,
  className = 'absolute inset-0 bg-cover bg-center bg-no-repeat',
  style,
}: RandomBackgroundProps) {
  const [src] = useState(() => pickPageBackground());

  return (
    <div
      data-testid="random-background"
      className={className}
      style={{
        backgroundImage: `url(${src})`,
        filter: `saturate(1.05) brightness(${brightness})`,
        ...(opacity !== undefined ? { opacity } : {}),
        ...style,
      }}
      aria-hidden
    />
  );
}
