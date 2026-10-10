import { SVGProps } from 'react';

export type MenRushIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

/**
 * Community: people group. Claude Design menrush-icons.
 */
export function IconCommunity({
  size = 24,
  filled = false,
  ...props
}: MenRushIconProps) {
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
      {...props}
    >
      {filled ? (
        <>
          <circle cx="12" cy="7.5" r="3" fill="currentColor" />
          <path d="M6.5 20a5.5 5.5 0 0 1 11 0z" fill="currentColor" />
          <circle cx="5" cy="9.5" r="2" fill="currentColor" />
          <circle cx="19" cy="9.5" r="2" fill="currentColor" />
          <path d="M2 18.5c0-2.2 1.6-3.8 3.6-3.9" />
          <path d="M22 18.5c0-2.2-1.6-3.8-3.6-3.9" />
        </>
      ) : (
        <>
          <circle cx="12" cy="7.5" r="3" />
          <path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
          <circle cx="5" cy="9.5" r="2" />
          <circle cx="19" cy="9.5" r="2" />
          <path d="M2 18.5c0-2.2 1.6-3.8 3.6-3.9" />
          <path d="M22 18.5c0-2.2-1.6-3.8-3.6-3.9" />
        </>
      )}
    </svg>
  );
}
