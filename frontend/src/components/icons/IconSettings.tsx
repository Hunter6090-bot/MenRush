import { SVGProps } from "react";

/** Standard settings cog — immediately recognisable on mobile and desktop. */
export function IconSettings({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9.4 3.2 10 5.1a7.3 7.3 0 0 1 4 0l.6-1.9 2.2 1.3-.9 1.8a7.4 7.4 0 0 1 2 2l1.8-.9 1.3 2.2-1.9.6a7.3 7.3 0 0 1 0 4l1.9.6-1.3 2.2-1.8-.9a7.4 7.4 0 0 1-2 2l.9 1.8-2.2 1.3-.6-1.9a7.3 7.3 0 0 1-4 0l-.6 1.9-2.2-1.3.9-1.8a7.4 7.4 0 0 1-2-2l-1.8.9L3 14.8l1.9-.6a7.3 7.3 0 0 1 0-4L3 9.6l1.3-2.2 1.8.9a7.4 7.4 0 0 1 2-2l-.9-1.8 2.2-1.3Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}
