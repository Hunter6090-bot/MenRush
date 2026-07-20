import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usersAPI } from '../api/client';

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'underage', label: 'Underage user' },
  { value: 'other', label: 'Other' },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]['value'];

interface ChatSafetyMenuProps {
  peerId: string;
  peerName: string;
  onNotice?: (message: string, tone?: 'success' | 'error') => void;
  onBlocked?: () => void;
}

export function ChatSafetyMenu({ peerId, peerName, onNotice, onBlocked }: ChatSafetyMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleBlock = async () => {
    setSubmitting(true);
    try {
      await usersAPI.blockUser(peerId);
      setBlockOpen(false);
      setMenuOpen(false);
      onNotice?.(`${peerName} has been blocked.`, 'success');
      onBlocked?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not block this user.';
      onNotice?.(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async () => {
    setSubmitting(true);
    try {
      await usersAPI.reportUser(peerId, reportReason, reportDetails.trim() || undefined);
      setReportOpen(false);
      setMenuOpen(false);
      setReportDetails('');
      onNotice?.('Report submitted. Our team will review it.', 'success');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not submit report.';
      onNotice?.(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div ref={rootRef} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Chat options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-[var(--bg-card)] active:scale-95 text-[var(--cream-muted)]"
        >
          <MoreIcon className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] py-1.5 shadow-2xl z-50"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-[var(--cream)] transition-colors hover:bg-[var(--bg-card)]"
            >
              Report {peerName}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setBlockOpen(true);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-[var(--nn-danger)] transition-colors hover:bg-[rgba(155,58,40,0.12)]"
            >
              Block {peerName}
            </button>
          </div>
        )}
      </div>

      {blockOpen && (
        <SafetyModal
          title={`Block ${peerName}?`}
          onClose={() => !submitting && setBlockOpen(false)}
          footer={
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setBlockOpen(false)}
                className="flex-1 h-11 rounded-xl text-sm font-semibold border border-[var(--border-default)] text-[var(--cream)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleBlock()}
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-[var(--nn-danger)] text-white disabled:opacity-50"
              >
                {submitting ? 'Blocking…' : 'Block'}
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-[var(--cream-muted)]">
            They won&apos;t be able to message you, call you, or see your profile. Blocking is private —
            they won&apos;t be notified.
          </p>
        </SafetyModal>
      )}

      {reportOpen && (
        <SafetyModal
          title={`Report ${peerName}`}
          onClose={() => !submitting && setReportOpen(false)}
          footer={
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReportOpen(false)}
                className="flex-1 h-11 rounded-xl text-sm font-semibold border border-[var(--border-default)] text-[var(--cream)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleReport()}
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-[var(--copper)] text-[var(--nn-on-copper)] disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Submit report'}
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed mb-4 text-[var(--cream-muted)]">
            Tell us what happened. Reports are reviewed by our moderation team.
          </p>
          <fieldset className="space-y-2">
            <legend className="sr-only">Reason for report</legend>
            {REPORT_REASONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer border transition-colors ${
                  reportReason === option.value
                    ? 'border-[var(--copper)] bg-[rgba(196,131,42,0.08)]'
                    : 'border-[var(--border-default)]'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={option.value}
                  checked={reportReason === option.value}
                  onChange={() => setReportReason(option.value)}
                  className="accent-[var(--copper)]"
                />
                <span className="text-sm text-[var(--cream)]">{option.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="block mt-4">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--cream-muted)]">
              Details (optional)
            </span>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Anything else we should know?"
              className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm resize-none bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--copper)]/50"
            />
          </label>
        </SafetyModal>
      )}
    </>
  );
}

function SafetyModal({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-modal-title"
        className="flex w-full max-w-md max-h-[min(92dvh,40rem)] flex-col overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--border-default)] px-5 pt-5 pb-3">
          <h2 id="safety-modal-title" className="text-lg font-bold text-[var(--cream)]">
            {title}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        <div className="shrink-0 flex gap-3 border-t border-[var(--border-default)] bg-[var(--bg-elevated)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const MoreIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);
