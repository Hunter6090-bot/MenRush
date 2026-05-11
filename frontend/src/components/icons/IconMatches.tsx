import { SVGProps } from "react";

/**
 * MenRush — Matches icon
 * Two interlocking signet rings. Connection without saccharine hearts.
 * Heritage / classical / masculine vocabulary.
 */
export function IconMatches({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Left ring */}
      <circle
        cx="9"
        cy="12"
        r="5.5"
        stroke="currentColor"
        strokeWidth="2"
      />

      {/* Right ring */}
      <circle
        cx="15"
        cy="12"
        r="5.5"
        stroke="currentColor"
        strokeWidth="2"
      />

      {/* Interlock illusion — a subtle highlight where they meet */}
      <path
        d="M12 6.8 A 5.5 5.5 0 0 1 14.4 7.7"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}
