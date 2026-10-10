import { SVGProps } from "react";

/**
 * MenRush — Rooms icon
 * Video camera + two overlapping people — group video rooms.
 */
export function IconRooms({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      {/* Back person — head + shoulders */}
      <circle cx="6" cy="5.75" r="2.1" />
      <path d="M2.5 13.25c0-1.85 1.55-3.35 3.5-3.35" />

      {/* Front person — overlapping */}
      <circle cx="10.75" cy="6.5" r="2.1" />
      <path d="M7.25 13.5c0-1.7 1.55-3.05 3.5-3.05s3.5 1.35 3.5 3.05" />

      {/* Camcorder body + lens */}
      <rect x="2.75" y="14.25" width="11.5" height="6.75" rx="1.5" />
      <circle cx="8.5" cy="17.6" r="1.85" />

      {/* Side viewfinder housing */}
      <path d="M14.25 15.75l4.5-2.35v8.2l-4.5-2.35" />
    </svg>
  );
}
