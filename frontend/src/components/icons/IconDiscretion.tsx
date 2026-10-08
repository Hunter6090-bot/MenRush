import { SVGProps, useId } from 'react';

export type MenRushIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

/**
 * Discretion: dashed radar + pin (map pin fuzz). Claude Design menrush-icons.
 */
export function IconDiscretion({
  size = 24,
  filled = false,
  ...props
}: MenRushIconProps) {
  const uid = useId().replace(/:/g, '');
  const maskId = `mr-disc-m-${uid}`;
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
      <circle cx="12" cy="12" r="10" strokeDasharray="0 3.93" />
      {filled ? (
        <>
          <defs>
            <mask id={maskId}>
              <rect width="24" height="24" fill="#fff" stroke="none" />
              <circle cx="12" cy="10" r="1.6" fill="#000" stroke="none" />
            </mask>
          </defs>
          <path
            d="M12 18s4.5-4.2 4.5-8a4.5 4.5 0 0 0-9 0c0 3.8 4.5 8 4.5 8z"
            fill="currentColor"
            mask={`url(#${maskId})`}
          />
        </>
      ) : (
        <>
          <path d="M12 18s4.5-4.2 4.5-8a4.5 4.5 0 0 0-9 0c0 3.8 4.5 8 4.5 8z" />
          <circle cx="12" cy="10" r="1.5" />
        </>
      )}
    </svg>
  );
}
