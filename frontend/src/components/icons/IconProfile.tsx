import { SVGProps } from 'react';

/**
 * You: person (head + shoulders), as drawn on the Claude Design board
 * (MenRush Phone App, 9 states). Outline idle, filled when active.
 */
export function IconProfile({
  size = 24,
  filled = false,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; filled?: boolean }) {
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
      data-icon="person"
      {...props}
    >
      <circle cx="12" cy="8" r="4" fill={filled ? 'currentColor' : 'none'} />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  );
}
