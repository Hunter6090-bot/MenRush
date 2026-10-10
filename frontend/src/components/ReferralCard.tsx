import React, { useEffect, useState } from 'react';
import { usersAPI } from '../api/client';

type ReferralSummary = Awaited<ReturnType<typeof usersAPI.getReferrals>>['data'];
type RewardMode = NonNullable<ReferralSummary['reward_mode']>;

/**
 * One end-date line per member situation, each true for that member
 * (backend: referral-earned-months.ts decides the mode).
 */
export const REFERRAL_WHEN_COPY: Record<RewardMode, string> = {
  free_for_everyone:
    'While Premium is free for everyone, your earned months are saved and start when free Premium ends.',
  open_ended: 'Your Premium has no end date, so your earned months are saved and start only if it ends.',
  paid: 'Each month you earn is added after your current paid period and stays if you renew or cancel.',
  end_date: 'Each month you earn is added after your current Premium end date.',
  no_end_date: 'Each month you earn starts the day you earn it.',
};

// Theme tokens only (light and dark): text >= 4.5:1, Copy >= 3:1, all text >= 15px.
const LABEL = 'text-[15px] font-bold uppercase tracking-[0.14em] text-[var(--cream-muted)]';
const BODY = 'text-[15px] leading-snug text-[var(--cream-muted)]';

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
        <p className={LABEL}>Referrals</p>
        <p className={`mt-2 ${BODY}`}>Loading…</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-5 shadow-card">
        <p className={LABEL}>Referrals</p>
        <p className={`mt-2 ${BODY}`}>{error || 'Unavailable'}</p>
      </div>
    );
  }

  const unlockEvery = summary.unlock_every || 3;
  const joined = summary.progress_to_unlock;
  const earned = summary.unlocks_earned;
  const saved = summary.months_saved ?? 0;
  const cap = summary.max_months_per_12_months ?? 6;
  const mode: RewardMode = summary.reward_mode ?? 'end_date';
  const monthWord = (n: number) => (n === 1 ? '1 month' : `${n} months`);

  return (
    <div
      className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-5 shadow-card space-y-4"
      data-testid="referral-card"
    >
      <div>
        <p className={LABEL}>Referrals</p>
        <p className="mt-1 text-base font-semibold text-[var(--cream)]" data-testid="referral-offer">
          Invite {unlockEvery} members and get 1 month Premium free
        </p>
      </div>

      <div className="flex items-center gap-2">
        <code
          className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2.5 font-mono text-base tracking-[0.12em] text-[var(--cream)]"
          data-testid="referral-code"
        >
          {summary.referral_code}
        </code>
        <button
          type="button"
          onClick={copyCode}
          aria-label="Copy referral code"
          className="min-h-[44px] min-w-[64px] rounded-xl border border-[var(--nn-accent-text)] bg-transparent px-4 text-[15px] font-semibold text-[var(--nn-accent-text)] hover:bg-[var(--bg-card-hover)]"
          data-testid="referral-copy"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="space-y-1.5">
        {/* At the cap the next month cannot be earned yet, so no progress line. */}
        {summary.at_cap ? null : (
          <p className="text-lg font-semibold text-[var(--cream)]" data-testid="referral-progress">
            {joined} of {unlockEvery} towards your next month
          </p>
        )}
        <p className={BODY} data-testid="referral-rule">
          A member counts once they sign up with your code and confirm their email. You can earn up to{' '}
          {monthWord(cap)} in any 12 months.
        </p>
        <p className={BODY} data-testid="referral-when">
          {REFERRAL_WHEN_COPY[mode]}
        </p>
        {summary.at_cap ? (
          <p className={BODY} data-testid="referral-cap">
            You have earned {monthWord(cap)} in the last 12 months, the most for now.
          </p>
        ) : null}
        {earned > 0 ? (
          <p className="text-[15px] text-[var(--cream-soft)]" data-testid="referral-earned">
            {monthWord(earned)} of Premium earned so far
            {saved > 0 ? `, ${saved === earned ? 'all' : saved} saved for later.` : '.'}
          </p>
        ) : null}
      </div>

      {summary.referrals.length > 0 ? (
        <div className="space-y-2" data-testid="referral-list">
          <p className={LABEL}>Referred</p>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto text-[15px]">
            {summary.referrals.map((r) => (
              <li
                key={r.referred_user_id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-default)]/60 px-2.5 py-1.5"
              >
                <span className="truncate text-[var(--cream-soft)]">{r.name || 'Member'}</span>
                <span className="shrink-0 text-[15px] text-[var(--cream-muted)]">
                  {r.qualified ? 'Joined' : 'Not counted yet'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={BODY}>No referrals yet.</p>
      )}

      {error ? (
        <p className="text-[15px] text-[var(--nn-danger-text)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
