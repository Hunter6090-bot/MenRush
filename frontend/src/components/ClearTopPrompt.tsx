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
  const offset = useClearanceBelowTopPrompt(ref);
  return (
    <div
      ref={ref}
      data-testid={testId}
      data-offset-for-banner={offset}
      style={offset > 0 ? { paddingTop: `${offset}px` } : undefined}
    >
      {children}
    </div>
  );
}
