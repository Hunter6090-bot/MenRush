import { SVGProps } from 'react';

/** MenRush — Notifications bell (soft curves, no sharp pin). */
export function IconNotifications({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 3.25c-2.65 0-4.75 2.05-4.75 4.65v2.35c0 .95-.35 1.85-.98 2.55l-.72.78a1 1 0 00.74 1.67h10.42a1 1 0 00.74-1.67l-.72-.78a3.6 3.6 0 01-.98-2.55V7.9c0-2.6-2.1-4.65-4.75-4.65z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 18.1a1.85 1.85 0 003.6 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
