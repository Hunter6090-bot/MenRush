import { SVGProps } from "react";

/**
 * MenRush — Chat icon
 * Sealed envelope with a copper wax seal at the centre.
 * Heritage tone. Different from every messaging app's bubble.
 */
export function IconChat({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Envelope body */}
      <rect
        x="3"
        y="6"
        width="18"
        height="14"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Envelope flap fold */}
      <path
        d="M3 7.5 L12 13.5 L21 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Wax seal */}
      <circle cx="12" cy="14" r="2.2" fill="currentColor" />
    </svg>
  );
}
