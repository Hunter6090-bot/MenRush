import { useState } from 'react';
import { usersAPI } from '../api/client';

interface PanicReportButtonProps {
  peerId?: string;
  conversationId?: string;
  roomId?: string;
  onNotice?: (message: string, tone?: 'success' | 'error') => void;
}

/** One-tap panic / report — queues the thread on SENTINEL. Does not change block. */
export function PanicReportButton({
  peerId,
  conversationId,
  roomId,
  onNotice,
}: PanicReportButtonProps) {
  const [sending, setSending] = useState(false);

  const handleClick = async () => {
    if (sending) return;
    setSending(true);
    try {
      await usersAPI.reportToSentinel({
        reason: 'panic',
        details: 'One-tap panic / report',
        reported_id: peerId,
        conversation_id: conversationId ?? peerId,
        room_id: roomId,
        source: roomId ? 'room' : 'panic',
      });
      onNotice?.('Report sent to SENTINEL. You’re not alone — we will review it.', 'success');
    } catch {
      onNotice?.('Could not send the report. Try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={sending}
      aria-label="Panic report"
      title="Report this chat to SENTINEL"
      data-testid="panic-report-button"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#C4A882] transition-colors hover:bg-[var(--bg-card)] hover:text-[#E0A14A] disabled:opacity-50"
    >
      <ShieldIcon className="h-5 w-5" />
    </button>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
      <path d="M12 8v5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
