import { SVGProps } from "react";

/**
 * MenRush — Profile icon
 * Single classical bust silhouette. The user as a coin face.
 * Mirrors the medallion language.
 */
export function IconProfile({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Head */}
      <circle cx="12" cy="8.5" r="3.8" />

      {/* Shoulders / bust */}
      <path d="M3.5 22 L3.5 17.5 C3.5 14.5 7 13 12 13 C17 13 20.5 14.5 20.5 17.5 L20.5 22 Z" />
    </svg>
  );
}
