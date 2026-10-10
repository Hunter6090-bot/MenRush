import { useRef, type ReactNode } from 'react';
import { useClearanceBelowTopPrompt } from '../lib/topPromptOverlay';

/** In-flow wrapper that pads its children below the floating alerts banner. */
export function ClearTopPrompt({
  children,
  testId = 'clear-top-prompt',
}: {
  children: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { offset, ready } = useClearanceBelowTopPrompt(ref);
  return (
    <div
      ref={ref}
      data-testid={testId}
      data-offset-for-banner={offset}
      data-overlay-ready={ready ? 'true' : 'false'}
      style={{
        ...(offset > 0 ? { paddingTop: `${offset}px` } : {}),
        visibility: ready ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  );
}
