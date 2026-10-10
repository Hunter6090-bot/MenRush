import { SVGProps } from 'react';

export type MenRushIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

/**
 * Out: half moon (night out), as drawn on the Claude Design board
 * (MenRush Phone App, 9 states). It must never look like the Map pin.
 * Outline idle, filled when active.
 */
export function IconOut({ size = 24, filled = false, ...props }: MenRushIconProps) {
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
      data-icon="half-moon"
      {...props}
    >
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}
