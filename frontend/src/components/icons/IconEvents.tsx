import { SVGProps } from "react";

/**
 * MenRush — Events icon
 * Classical pediment plaque — public notice board / gathering hall.
 * Matches the Doric column vocabulary of IconRooms.
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
      <path d="M4 8 L12 3.5 L20 8" />
      <rect x="5" y="8" width="14" height="12" rx="1" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="15" x2="16" y2="15" />
      <line x1="8" y1="18" x2="13" y2="18" />
    </svg>
  );
}