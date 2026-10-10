import { SVGProps } from 'react';

export type MenRushIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

/**
 * Rooms: video camera, as drawn on the Claude Design board
 * (MenRush Phone App, 9 states). Outline idle, filled when active.
 */
export function IconRooms({ size = 24, filled = false, ...props }: MenRushIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-icon="video-camera"
      {...props}
    >
      <rect x="2" y="6" width="14" height="12" rx="2.5" fill={filled ? 'currentColor' : 'none'} />
      <path d="M16 10.5l6-3.5v10l-6-3.5z" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  );
}
