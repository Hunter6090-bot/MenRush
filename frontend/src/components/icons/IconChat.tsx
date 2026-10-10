import { SVGProps } from 'react';

/**
 * Chat: speech bubble, as drawn on the Claude Design board
 * (MenRush Phone App, 9 states). Outline idle, filled when the tab is active.
 * Replaces the old envelope + wax seal glyph everywhere it was used.
 */
export function IconChat({
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
      data-icon="chat-bubble"
      {...props}
    >
      <path
        d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}
