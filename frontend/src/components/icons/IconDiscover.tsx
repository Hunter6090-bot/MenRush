import { SVGProps } from "react";

/**
 * MenRush — Nearby / Discover icon
 * Soft map tile with concentric radius rings — no pin, all curves.
 */
export function IconDiscover({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Map frame */}
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.75"
      />

      {/* Outer search radius */}
      <circle
        cx="12"
        cy="12"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />

      {/* Inner radius */}
      <circle
        cx="12"
        cy="12"
        r="3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.65"
      />

      {/* You are here */}
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
    </svg>
  );
}
