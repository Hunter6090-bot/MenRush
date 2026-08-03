import { SVGProps } from "react";

/**
 * MenRush — Settings icon
 * Doric column capital and shaft — structure and preference.
 * Same classical architecture language as IconRooms.
 */
export function IconSettings({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <line x1="6" y1="6" x2="18" y2="6" />
      <line x1="7.5" y1="8" x2="16.5" y2="8" />
      <rect x="10" y="8" width="4" height="11" />
      <line x1="7.5" y1="19" x2="16.5" y2="19" />
      <line x1="6" y1="21" x2="18" y2="21" />
    </svg>
  );
}