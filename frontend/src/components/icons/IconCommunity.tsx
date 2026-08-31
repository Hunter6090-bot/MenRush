import { SVGProps } from 'react';

/**
 * Community — overlapping speech bubbles (people posting).
 * Not a map pin, not a column, not the MenRush medallion, not a video camera.
 */
export function IconCommunity({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      {/* Back bubble */}
      <path
        d="M5.5 5.5h9a3 3 0 0 1 3 3v4.25a3 3 0 0 1-3 3H11l-3.25 2.4V15.75H5.5a3 3 0 0 1-3-3V8.5a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* Front bubble */}
      <path
        d="M9.5 8.75h9a3 3 0 0 1 3 3v4.25a3 3 0 0 1-3 3H15l-3.25 2.4V19H9.5a3 3 0 0 1-3-3v-4.25a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Post dots */}
      <circle cx="12.25" cy="14.1" r="0.9" fill="currentColor" />
      <circle cx="15" cy="14.1" r="0.9" fill="currentColor" />
      <circle cx="17.75" cy="14.1" r="0.9" fill="currentColor" />
    </svg>
  );
}
