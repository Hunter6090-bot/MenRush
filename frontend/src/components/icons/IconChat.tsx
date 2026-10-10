import { SVGProps } from 'react';

/**
 * Chat: round speech bubble, outlined, as drawn on the Claude Design board
 * (MenRush Phone App, 9 states). Always an outline: the active tab shows it in
 * the copper accent, never filled. Path is Lucide's message-circle.
 * Replaces the old envelope + wax seal glyph everywhere it was used.
 */
export function IconChat({
  size = 24,
  // Nav items may pass `filled`; Chat ignores it so it stays an outline (board).
  filled: _outlineOnly,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; filled?: boolean }) {
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
      data-icon="chat-bubble"
      {...props}
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" fill="none" />
    </svg>
  );
}
