import { SVGProps } from "react";

/**
 * MenRush — Matches icon
 * Two profile silhouettes facing each other — mutual connection.
 */
export function IconMatches({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Left figure — facing right */}
      <circle cx="7" cy="7.5" r="3" />
      <path d="M2.5 21.5 L2.5 17.5 C2.5 14.5 4.5 12.5 7 12.5 C9.5 12.5 11.5 14.5 11.5 17.5 L11.5 21.5 Z" />

      {/* Right figure — facing left */}
      <circle cx="17" cy="7.5" r="3" />
      <path d="M21.5 21.5 L21.5 17.5 C21.5 14.5 19.5 12.5 17 12.5 C14.5 12.5 12.5 14.5 12.5 17.5 L12.5 21.5 Z" />

      {/* Connecting glance */}
      <line x1="10" y1="7.5" x2="14" y2="7.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}
