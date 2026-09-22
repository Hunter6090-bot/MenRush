import { SVGProps } from "react";

/**
 * MenRush — Unmatch icon
 * Broken / parting rings — mutual match severed.
 * Heritage / classical tone matching IconMatches.
 */
export function IconUnmatch({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Left split ring */}
      <path
        d="M9 6.5A5.5 5.5 0 1 0 14.5 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Right split ring */}
      <path
        d="M15 17.5A5.5 5.5 0 1 0 9.5 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Sever line */}
      <line
        x1="7"
        y1="17"
        x2="17"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
