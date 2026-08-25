import React from 'react';

/** Soft blur for Discreet Mode when backend sets media_clear=false. */
export const DISCREET_MEDIA_BLUR_CSS = 'blur(18px) saturate(1.05)';

export function shouldBlurMedia(mediaClear: boolean | null | undefined): boolean {
  // Absent / true → clear (feature off, Premium, own media, or older payloads).
  return mediaClear === false;
}

type SoftBlurMediaProps = {
  blurred: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** Optional test id for the blur wrapper. */
  'data-testid'?: string;
};

/**
 * Wraps photo/video content. When blurred, applies a soft CSS filter.
 * No public marketing copy — owner-account test first.
 */
export function SoftBlurMedia({
  blurred,
  className,
  style,
  children,
  'data-testid': testId,
}: SoftBlurMediaProps) {
  if (!blurred) {
    return (
      <div className={className} style={style} data-testid={testId}>
        {children}
      </div>
    );
  }
  return (
    <div
      className={className}
      style={style}
      data-testid={testId ?? 'media-discreet-blur'}
      data-media-clear="0"
    >
      <div
        aria-hidden
        style={{
          filter: DISCREET_MEDIA_BLUR_CSS,
          transform: 'scale(1.06)',
          transformOrigin: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}
