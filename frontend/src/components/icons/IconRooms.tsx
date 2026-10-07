import { SVGProps, useId } from 'react';

export type MenRushIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

/**
 * Rooms — video frame + people. Claude Design menrush-icons.
 */
export function IconRooms({
  size = 24,
  filled = false,
  ...props
}: MenRushIconProps) {
  const uid = useId().replace(/:/g, '');
  const maskId = `mr-rooms-m-${uid}`;
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
          <defs>
            <mask id={maskId}>
              <rect width="24" height="24" fill="#fff" stroke="none" />
              <circle cx="6" cy="10" r="1.9" fill="#000" stroke="none" />
              <circle cx="12" cy="10" r="1.9" fill="#000" stroke="none" />
              <path d="M3 17a3 3 0 0 1 6 0z" fill="#000" stroke="none" />
              <path d="M9 17a3 3 0 0 1 6 0z" fill="#000" stroke="none" />
            </mask>
          </defs>
          <rect
            x="1.5"
            y="5"
            width="15"
            height="14"
            rx="2.5"
            fill="currentColor"
            stroke="currentColor"
            mask={`url(#${maskId})`}
          />
          <path d="M16.5 10.5l5.5-3v9l-5.5-3z" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="1.5" y="5" width="15" height="14" rx="2.5" />
          <path d="M16.5 10.5l5.5-3v9l-5.5-3" />
          <circle cx="6" cy="9.75" r="1.75" fill="currentColor" stroke="none" />
          <circle cx="12" cy="9.75" r="1.75" fill="currentColor" stroke="none" />
          <path d="M3.5 16.5a2.5 2.5 0 0 1 5 0" />
          <path d="M9.5 16.5a2.5 2.5 0 0 1 5 0" />
        </>
      )}
    </svg>
  );
}
