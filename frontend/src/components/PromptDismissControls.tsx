import { useId, useState, type ReactNode } from 'react';

interface PromptDismissControlsProps {
  /** Called with true when "Don't remind me again" is ticked. */
  onClose: (forever: boolean) => void;
  /** Accessible name for the Close button, e.g. "Close get the app". */
  closeLabel: string;
  testIdPrefix: string;
  className?: string;
  /** Primary action, shown after Close (e.g. Turn on). */
  children?: ReactNode;
}

/**
 * Shared "Don't remind me again" tick plus Close for recurring prompts.
 * Same control on every phone and browser. Tap targets are 44px, text 15px,
 * colours are theme tokens only.
 */
export function PromptDismissControls({
  onClose,
  closeLabel,
  testIdPrefix,
  className = '',
  children,
}: PromptDismissControlsProps) {
  const [forever, setForever] = useState(false);
  const inputId = useId();

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <label
        htmlFor={inputId}
        className="mr-auto inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[15px] font-semibold text-[var(--cream)]"
        data-testid={`${testIdPrefix}-never-label`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={forever}
          onChange={(e) => setForever(e.target.checked)}
          data-testid={`${testIdPrefix}-never`}
          className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--nn-accent-text)]"
        />
        Don&apos;t remind me again
      </label>
      <button
        type="button"
        onClick={() => onClose(forever)}
        aria-label={closeLabel}
        data-testid={`${testIdPrefix}-close`}
        className="min-h-[44px] min-w-[44px] rounded-xl px-4 text-[15px] font-bold text-[var(--cream)]"
      >
        Close
      </button>
      {children}
    </div>
  );
}
