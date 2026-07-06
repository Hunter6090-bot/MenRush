import { SVGProps } from 'react';

export function IconEvents({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M8 2v4M16 2v4M3 9h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 13h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" fill="currentColor" />
    </svg>
  );
}
