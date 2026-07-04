import { SVGProps } from "react";

/**
 * MenRush — Rooms icon
 * Two Doric columns supporting a horizontal beam.
 * "Place to gather, structure, meeting hall." Classical architecture vocabulary.
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
      {...props}
    >
      {/* Top beam (architrave) */}
      <line x1="3" y1="5" x2="21" y2="5" />

      {/* Left column capital */}
      <line x1="4" y1="7" x2="9" y2="7" />
      {/* Left column shaft */}
      <rect x="5.5" y="7" width="2" height="12" />
      {/* Left column base */}
      <line x1="4" y1="19" x2="9" y2="19" />

      {/* Right column capital */}
      <line x1="15" y1="7" x2="20" y2="7" />
      {/* Right column shaft */}
      <rect x="16.5" y="7" width="2" height="12" />
      {/* Right column base */}
      <line x1="15" y1="19" x2="20" y2="19" />

      {/* Floor line */}
      <line x1="3" y1="21" x2="21" y2="21" />
    </svg>
  );
}
