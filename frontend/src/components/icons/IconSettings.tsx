import { SVGProps } from 'react';

export function IconSettings({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 3.5v2.2M12 18.3V20.5M20.5 12h-2.2M5.7 12H3.5M18.2 5.8l-1.55 1.55M7.35 16.65l-1.55 1.55M18.2 18.2l-1.55-1.55M7.35 7.35L5.8 5.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
