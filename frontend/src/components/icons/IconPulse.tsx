import { SVGProps } from "react";

/**
 * MenRush — Pulse icon
 * Concentric pulse rings radiating from a centre point.
 * Add `className="animate-pulse-breathe"` to make it actively pulse on the map.
 * Sonar / heartbeat aesthetic. The headline feature visual.
 */
export function IconPulse({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Centre dot */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />

      {/* Inner pulse ring */}
      <circle
        cx="12"
        cy="12"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.7"
      />

      {/* Outer pulse ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.35"
      />
    </svg>
  );
}
