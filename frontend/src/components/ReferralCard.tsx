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
  const joined = summary.progress_to_unlock;
  const earned = summary.unlocks_earned;

  return (
    <div
      className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-5 shadow-card space-y-4"
      data-testid="referral-card"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
          Referrals
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--cream)]" data-testid="referral-offer">
          Invite {unlockEvery} members and get 1 month Premium free
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

      <div className="space-y-1.5 text-sm">
        <p className="text-lg font-semibold text-[var(--cream)]" data-testid="referral-progress">
          {joined} of {unlockEvery} joined
        </p>
        <p className="text-xs text-[var(--cream-muted)]" data-testid="referral-rule">
          A member counts once they sign up with your code and confirm their email. It repeats for
          every {unlockEvery} members.
        </p>
        <p className="text-xs text-[var(--cream-muted)]" data-testid="referral-when">
          Each month you earn is added after your current Premium end date. If you have no current end date,
          it starts the day you earn it.
        </p>
        {earned > 0 ? (
          <p className="text-xs text-[var(--cream-soft)]" data-testid="referral-earned">
            {earned === 1 ? '1 month of Premium earned so far.' : `${earned} months of Premium earned so far.`}
          </p>
        ) : null}
      </div>

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
                  {r.qualified ? 'Joined' : 'Not counted yet'}
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
