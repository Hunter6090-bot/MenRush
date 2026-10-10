import { useId, useState, type ReactNode } from 'react';

interface PromptDismissControlsProps {
  /** Called with true when "Don't show again" is ticked. */
  onClose: (forever: boolean) => void;
  /** Accessible name for the Close button, e.g. "Close get the app". */
  closeLabel: string;
  testIdPrefix: string;
  className?: string;
  /** Primary action, shown after Close (e.g. Turn on). */
  children?: ReactNode;
}

/**
 * Shared "Don't show again" tick plus Close for recurring prompts.
 * Same control on every phone and browser. The tick draws at ~20px; the tap
 * target is 44px. Text is 15px. Colours are theme tokens only.
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
        {/*
          Custom bordered box (QC P1 on #354): the native iPhone light box border was
          1.59:1. The border is --cream-muted, at least 7:1 on the card and the copper
          tinted strip in light and dark. Ticked fills with --nn-accent-text and the tick
          is --bg-card, at least 4.5:1 in both themes.
        */}
        <span className="relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center">
          <input
            id={inputId}
            type="checkbox"
            checked={forever}
            onChange={(e) => setForever(e.target.checked)}
            data-testid={`${testIdPrefix}-never`}
            className="peer absolute inset-0 z-10 h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer appearance-none opacity-0"
          />
          <span
            aria-hidden
            data-testid={`${testIdPrefix}-never-box`}
            className="pointer-events-none h-5 w-5 rounded-[3px] border-2 border-[var(--cream-muted)] bg-transparent peer-checked:border-[var(--nn-accent-text)] peer-checked:bg-[var(--nn-accent-text)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--nn-accent-text)]"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute hidden h-3.5 w-3.5 text-[var(--bg-card)] peer-checked:block"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid={`${testIdPrefix}-never-tick`}
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        Don&apos;t show again
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
