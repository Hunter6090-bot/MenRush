import { SVGProps } from 'react';

/**
 * MenRush — Hot Spots icon
 * Cruise ship — venue / social hotspot (distinct from Events calendar).
 */
export function IconHotSpots({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      {/* Hull */}
      <path d="M3 15.5c1.2 1.6 3.4 2.5 9 2.5s7.8-.9 9-2.5H3z" />
      <path d="M4.5 15.5L6 11h12l1.5 4.5" />
      {/* Superstructure */}
      <path d="M8 11V8.5c0-.8.7-1.5 1.5-1.5H12v4" />
      <path d="M12 11V7h2.5c.8 0 1.5.7 1.5 1.5V11" />
      {/* Funnel */}
      <path d="M13.5 7V4.5h2V7" />
      {/* Waterline detail */}
      <path d="M5 18.5h14" opacity="0.55" />
      {/* Portholes */}
      <circle cx="9" cy="13" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
