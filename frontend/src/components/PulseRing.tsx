/**
 * PulseRing — copper pulsing-ring loader.
 *
 * Replaces generic <Spinner /> usages across the app. Reads brand tokens
 * from menrush-tokens.css (--copper, animate-pulse-breathe, animate-pulse-ring).
 *
 * Two concentric rings: a solid copper ring that breathes, and an outer ring
 * that radiates outward and fades. Default size 16px (inline). Pass `size`
 * for larger contexts (e.g. full-page loaders use 32-48).
 */
type Props = {
  size?: number;
  className?: string;
  label?: string;
};

export const PulseRing = ({ size = 16, className = '', label = 'Loading' }: Props) => {
  const px = `${size}px`;
  const ringWidth = Math.max(2, Math.round(size / 8));
  return (
    <span
      role="status"
      aria-label={label}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      {/* Outer radiating ring */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full animate-pulse-ring"
        style={{
          border: `${ringWidth}px solid var(--copper)`,
          boxShadow: '0 0 12px var(--copper-glow)',
        }}
      />
      {/* Inner breathing ring */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full animate-pulse-breathe"
        style={{
          border: `${ringWidth}px solid var(--copper)`,
          background: 'radial-gradient(circle, var(--copper-glow) 0%, transparent 70%)',
        }}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
};

export default PulseRing;
