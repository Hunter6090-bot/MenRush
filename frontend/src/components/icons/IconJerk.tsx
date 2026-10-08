import { SVGProps } from 'react';

export type IconJerkProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

/**
 * Jerk: winking smirk (one-tap nudge). Copper outline, same 24px grid,
 * stroke 2 and round caps as the Claude Design menrush-icons pack.
 * `filled` = sent state.
 */
export function IconJerk({ size = 24, filled = false, ...props }: IconJerkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-filled={filled ? 'true' : 'false'}
      {...props}
    >
      <circle cx="12" cy="12" r="9" fill={filled ? 'currentColor' : 'none'} />
      <g stroke={filled ? 'var(--bg-primary, #0D0A06)' : 'currentColor'}>
        {/* open eye */}
        <path d="M8.5 9.5v1" />
        {/* winking eye */}
        <path d="M14 10.2c.6-.6 1.6-.6 2.2 0" />
        {/* smirk */}
        <path d="M8.5 14.6c1.6 1.3 4.3 1.5 6.6-.4" />
      </g>
    </svg>
  );
}
