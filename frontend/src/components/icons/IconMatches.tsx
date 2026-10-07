import { SVGProps } from 'react';

export type MenRushIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  /** Filled/copper active state; outline idle. Claude Design pack. */
  filled?: boolean;
};

/**
 * Matches — two people + spark. Claude Design menrush-icons.
 */
export function IconMatches({
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
          <circle cx="6.5" cy="10" r="2.5" fill="currentColor" />
          <path d="M2 20a4.5 4.5 0 0 1 9 0z" fill="currentColor" />
          <circle cx="17.5" cy="10" r="2.5" fill="currentColor" />
          <path d="M13 20a4.5 4.5 0 0 1 9 0z" fill="currentColor" />
          <path
            d="M12 2l.9 2.1 2.1.9-2.1.9L12 8l-.9-2.1L9 5l2.1-.9z"
            strokeWidth={1.5}
            fill="currentColor"
          />
        </>
      ) : (
        <>
          <circle cx="6.5" cy="10" r="2.5" />
          <path d="M2 20a4.5 4.5 0 0 1 9 0" />
          <circle cx="17.5" cy="10" r="2.5" />
          <path d="M13 20a4.5 4.5 0 0 1 9 0" />
          <path
            d="M12 2l.9 2.1 2.1.9-2.1.9L12 8l-.9-2.1L9 5l2.1-.9z"
            strokeWidth={1.5}
            fill="currentColor"
          />
        </>
      )}
    </svg>
  );
}
