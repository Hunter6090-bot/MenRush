import { Link } from 'react-router-dom';
import type { useVerification } from '../hooks/useVerification';

export function ProfileVerification({ verification }: { verification: ReturnType<typeof useVerification> }) {
  const { status, loading, error, start, refresh } = verification;
  if (status?.is_verified) return null;
  const session = status?.veriff_status;
  const checking = session === 'submitted' || session === 'review';
  const resume = session === 'created' || session === 'started' || session === 'resubmission_requested';
  const actionNeeded = session === 'resubmission_requested' || session === 'declined' || session === 'expired' || session === 'abandoned';
  const title = checking ? 'Checking your verification' : actionNeeded ? 'Action needed' : 'Get your Verified badge';
  const copy = checking
    ? 'You can keep using MenRush. Your badge appears here once Veriff approves.'
    : session === 'resubmission_requested'
      ? 'Veriff needs another submission. Continue your check to see what is needed.'
      : session === 'declined'
        ? 'Veriff did not approve your check. You have not received a Verified badge.'
        : session === 'expired' || session === 'abandoned'
          ? 'Your previous check ended before completion. You can start again.'
          : 'Verify your ID and take a live selfie with Veriff. Free and optional.';
  return (
    <section aria-label="Profile verification" className="mt-4 rounded-2xl border border-[var(--copper)]/35 bg-[var(--copper)]/5 p-4">
      <h3 className="text-sm font-bold text-[var(--cream)]">{title}</h3>
      <p role="status" className="mt-1 text-sm leading-5 text-[var(--cream-muted)]">{copy}</p>
      {error ? <p role="alert" className="mt-2 text-sm text-[var(--cream)]">{error}</p> : null}
      {!status ? (
        error ? <button type="button" onClick={() => void refresh()} className="mt-3 min-h-11 font-bold text-[var(--copper)]">Try again</button>
          : <p className="mt-2 text-sm text-[var(--cream-muted)]">Loading verification status…</p>
      ) : !checking ? (
        <button type="button" disabled={loading} onClick={() => void start()} className="mt-3 min-h-11 rounded-xl bg-[#C4832A] px-5 py-2.5 text-sm font-bold text-[#1A0E03] disabled:opacity-60">
          {loading ? 'Opening Veriff…' : resume ? 'Continue verification' : actionNeeded ? 'Try again' : 'Get verified'}
        </button>
      ) : error ? <button type="button" onClick={() => void refresh()} className="mt-3 min-h-11 font-bold text-[var(--copper)]">Refresh status</button> : null}
      <Link to="/privacy" className="ml-3 inline-block py-3 text-xs text-[var(--cream-muted)] underline">Privacy</Link>
    </section>
  );
}
