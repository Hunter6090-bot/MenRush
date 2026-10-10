import React, { useEffect, useState } from 'react';
import { usersAPI } from '../api/client';

type ReferralSummary = Awaited<ReturnType<typeof usersAPI.getReferrals>>['data'];

export function ReferralCard() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await usersAPI.getReferrals();
        if (!cancelled) setSummary(res.data);
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Could not load referrals';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyCode = async () => {
    if (!summary?.referral_code) return;
    try {
      await navigator.clipboard.writeText(summary.referral_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Copy failed. Select the code manually.');
    }
  };

  if (loading) {
    return (
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-5 shadow-card"
        data-testid="referral-card-loading"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
          Referrals
        </p>
        <p className="mt-2 text-sm text-[var(--cream-muted)]">Loading…</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-5 shadow-card">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
          Referrals
        </p>
        <p className="mt-2 text-sm text-[var(--cream-muted)]">{error || 'Unavailable'}</p>
      </div>
    );
  }

  const unlockEvery = summary.unlock_every || 3;
  const progress = summary.progress_to_unlock;
  const verified = summary.verified_count;

  return (
    <div
      className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-5 shadow-card space-y-4"
      data-testid="referral-card"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
          Referrals
        </p>
        <p className="mt-1 text-sm text-[var(--cream-soft)]">
          Share your code. Friends unlock Premium for you after they verify.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <code
          className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-deep)] px-3 py-2 font-mono text-sm tracking-[0.12em] text-[#F0E0C0]"
          data-testid="referral-code"
        >
          {summary.referral_code}
        </code>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-xl border border-[#C4832A]/30 bg-[#C4832A]/15 px-3 py-2 text-xs font-semibold text-[#C4832A] hover:bg-[#C4832A]/25"
          data-testid="referral-copy"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--cream-muted)]">
            Verified
          </p>
          <p className="mt-0.5 text-lg font-semibold text-[var(--cream)]" data-testid="referral-verified-count">
            {verified}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--cream-muted)]">
            To next unlock
          </p>
          <p className="mt-0.5 text-lg font-semibold text-[var(--cream)]" data-testid="referral-progress">
            {progress}/{unlockEvery}
          </p>
        </div>
      </div>

      <p className="text-xs text-[var(--cream-muted)]">
        {unlockEvery} verified referrals unlock 1 month of Premium
        {summary.unlocks_earned > 0 ? ` · ${summary.unlocks_earned} unlocked` : ''}.
      </p>

      {summary.pending_payout_total > 0 ? (
        <p className="text-sm text-[#E0A14A]" data-testid="referral-pending-payout">
          Pending payout: £{summary.pending_payout_total.toFixed(2)}
        </p>
      ) : null}

      {summary.referrals.length > 0 ? (
        <div className="space-y-2" data-testid="referral-list">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cream-muted)]">
            Referred
          </p>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
            {summary.referrals.map((r) => (
              <li
                key={r.referred_user_id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-default)]/60 px-2.5 py-1.5"
              >
                <span className="truncate text-[var(--cream-soft)]">{r.name || 'Member'}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--cream-muted)]">
                  {r.status}
                  {r.payout_amount > 0 ? ` · £${r.payout_amount.toFixed(2)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-[var(--cream-muted)]">No referrals yet.</p>
      )}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
