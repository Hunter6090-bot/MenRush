import React, { useEffect, useRef, useState } from 'react';
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
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-[#3D2B0E]/50 active:scale-95"
          style={{ color: '#A89070' }}
        >
          <MoreIcon className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-52 rounded-2xl border py-1.5 shadow-2xl z-50"
            style={{ background: '#1E1508', borderColor: '#3D2B0E' }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#3D2B0E]/40"
              style={{ color: '#F0E0C0' }}
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
              className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#A45E18]/15"
              style={{ color: '#EF4444' }}
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
        >
          <p className="text-sm leading-relaxed" style={{ color: '#A89070' }}>
            They won&apos;t be able to message you, call you, or see your profile. Blocking is private —
            they won&apos;t be notified.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setBlockOpen(false)}
              className="flex-1 h-11 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50"
              style={{ borderColor: '#3D2B0E', color: '#F0E0C0' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleBlock()}
              className="flex-1 h-11 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: '#dc2626', color: '#fff' }}
            >
              {submitting ? 'Blocking…' : 'Block'}
            </button>
          </div>
        </SafetyModal>
      )}

      {reportOpen && (
        <SafetyModal title={`Report ${peerName}`} onClose={() => !submitting && setReportOpen(false)}>
          <p className="text-sm leading-relaxed mb-4" style={{ color: '#A89070' }}>
            Tell us what happened. Reports are reviewed by our moderation team.
          </p>
          <fieldset className="space-y-2">
            <legend className="sr-only">Reason for report</legend>
            {REPORT_REASONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer border transition-colors"
                style={{
                  borderColor: reportReason === option.value ? '#C4832A' : '#3D2B0E',
                  background: reportReason === option.value ? 'rgba(196,131,42,0.08)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={option.value}
                  checked={reportReason === option.value}
                  onChange={() => setReportReason(option.value)}
                  className="accent-[#C4832A]"
                />
                <span className="text-sm" style={{ color: '#F0E0C0' }}>
                  {option.label}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="block mt-4">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#A89070' }}>
              Details (optional)
            </span>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Anything else we should know?"
              className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C4832A]/50"
              style={{
                background: '#0D0A06',
                border: '1px solid #3D2B0E',
                color: '#F0E0C0',
              }}
            />
          </label>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setReportOpen(false)}
              className="flex-1 h-11 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50"
              style={{ borderColor: '#3D2B0E', color: '#F0E0C0' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleReport()}
              className="flex-1 h-11 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: '#C4832A', color: '#0D0A06' }}
            >
              {submitting ? 'Sending…' : 'Submit report'}
            </button>
          </div>
        </SafetyModal>
      )}
    </>
  );
}

function SafetyModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-modal-title"
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{ background: '#1E1508', border: '1px solid #3D2B0E' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="safety-modal-title" className="text-lg font-bold" style={{ color: '#F0E0C0' }}>
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const MoreIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);
