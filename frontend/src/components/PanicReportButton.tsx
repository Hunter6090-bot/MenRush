import { useState } from 'react';
import { usersAPI } from '../api/client';

interface PanicReportButtonProps {
  /** User the report is filed against (DM peer, or room owner / other member). */
  reportedUserId: string;
  /** Conversation or room thread id for SENTINEL review. */
  threadId: string;
  onNotice?: (message: string, tone?: 'success' | 'error') => void;
  className?: string;
}

/**
 * Discreet one-tap safety report for chat / room headers.
 * Free for all users. Reuses POST /users/report/:id — does not change block.
 * Calm copy only; no public claim of a new safety product.
 */
export function PanicReportButton({
  reportedUserId,
  threadId,
  onNotice,
  className = '',
}: PanicReportButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReport = async () => {
    if (submitting || sent || !reportedUserId || !threadId) return;
    setSubmitting(true);
    try {
      await usersAPI.reportUser(reportedUserId, 'other', undefined, threadId);
      setSent(true);
      onNotice?.("Report sent. We'll take a look.", 'success');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not send report.';
      onNotice?.(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="panic-report-button"
      onClick={() => void handleReport()}
      disabled={submitting || sent || !reportedUserId}
      aria-label={sent ? 'Report sent' : 'Report this conversation'}
      title={sent ? 'Report sent' : 'Report'}
      className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-[var(--bg-card)] active:scale-95 disabled:opacity-55 disabled:pointer-events-none text-[var(--cream-muted)] hover:text-[var(--cream)] ${className}`}
    >
      {sent ? <CheckShieldIcon className="w-5 h-5" /> : <FlagIcon className="w-5 h-5" />}
    </button>
  );
}

const FlagIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 21V4" />
    <path d="M5 4h9.5a1 1 0 0 1 .85 1.53L13.4 9l1.95 3.47A1 1 0 0 1 14.5 14H5" />
  </svg>
);

const CheckShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
  </svg>
);
