import { SVGProps } from 'react';

/**
 * MenRush — Events icon
 * Calendar (month grid) — clear “events / dates” meaning.
 */
export function IconEvents({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Binding rings */}
      <path d="M8 3v3M16 3v3" />
      {/* Calendar body */}
      <rect x="4" y="5" width="16" height="16" rx="2" />
      {/* Header bar */}
      <path d="M4 10h16" />
      {/* Date dots / grid marks */}
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeWidth="2" />
    </svg>
  );
}
