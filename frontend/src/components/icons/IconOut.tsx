import { SVGProps, useId } from 'react';

export type MenRushIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

/**
 * Out: map pin + star (venues / cruise / events). Claude Design menrush-icons.
 */
export function IconOut({
  size = 24,
  filled = false,
  ...props
}: MenRushIconProps) {
  const uid = useId().replace(/:/g, '');
  const maskId = `mr-out-m-${uid}`;
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
              <path
                d="M12 6.2L12.94 8.51L15.42 8.69L13.52 10.29L14.12 12.71L12 11.4L9.88 12.71L10.48 10.29L8.58 8.69L11.06 8.51Z"
                fill="#000"
                stroke="none"
              />
            </mask>
          </defs>
          <path
            d="M12 22s7-6.5 7-12.5a7 7 0 0 0-14 0C5 15.5 12 22 12 22z"
            fill="currentColor"
            mask={`url(#${maskId})`}
          />
        </>
      ) : (
        <>
          <path d="M12 22s7-6.5 7-12.5a7 7 0 0 0-14 0C5 15.5 12 22 12 22z" />
          <path
            d="M12 6.2L12.94 8.51L15.42 8.69L13.52 10.29L14.12 12.71L12 11.4L9.88 12.71L10.48 10.29L8.58 8.69L11.06 8.51Z"
            strokeWidth={1.5}
          />
        </>
      )}
    </svg>
  );
}
