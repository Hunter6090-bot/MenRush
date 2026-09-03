import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { verifyAPI, type VerifyStatus } from '../api/verify';
import { VerifiedBadge } from '../components/VerifiedBadge';

function StatusPill({ label, complete }: { label: string; complete: boolean }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
      complete
        ? 'border-[#22C55E]/45 bg-[#22C55E]/10 text-[#86EFAC]'
        : 'border-[var(--border-default)] text-[var(--cream-muted)]'
    }`}>
      {label}
    </span>
  );
}

export function VerificationCentre() {
  const [state, setState] = useState<VerifyStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    verifyAPI.status().then((res) => setState(res.data)).catch(() => setError('Could not load verification status.'));
  }, []);

  const identity = Boolean(state?.is_verified);

  return (
    <Layout>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6" data-testid="trust-centre">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--copper)]">Trust centre</p>
        <h1 className="mt-2 font-display text-3xl font-black text-[var(--cream)]">Optional identity check</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--cream-muted)]">
          Optional. Not required to use the app. One private Veriff check — government ID matched to a live selfie.
          Unverified is the default. 18+ stays on the signup date-of-birth line.
        </p>

        {error ? <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}

        <div className="mt-6 space-y-3">
          <section className="mr-card p-5" data-testid="trust-veriff-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-[var(--cream)]">Identity check</h2>
                <p className="mt-1 text-sm leading-5 text-[var(--cream-muted)]">
                  Optional government ID privately matched to a live selfie via Veriff. Pass or fail from Veriff only — no team review queue.
                </p>
              </div>
              <StatusPill
                label={identity ? 'Confirmed' : state?.status === 'pending' ? 'In review' : 'Optional'}
                complete={identity}
              />
            </div>
            {identity ? (
              <div className="mt-4" data-testid="trust-verified-mark">
                <VerifiedBadge />
              </div>
            ) : null}
            {!identity && state?.status !== 'pending' ? (
              <Link
                to="/verify/id"
                className="mt-4 inline-flex rounded-xl bg-[var(--copper)] px-4 py-2.5 text-sm font-bold text-[var(--nn-on-copper)]"
                data-testid="trust-start-veriff"
              >
                Check my identity
              </Link>
            ) : null}
            {!identity && state?.status === 'pending' ? (
              <Link
                to="/verify/pending"
                className="mt-4 inline-flex rounded-xl border border-[var(--copper)]/60 px-4 py-2.5 text-sm font-bold text-[var(--copper)]"
              >
                View status
              </Link>
            ) : null}
          </section>
        </div>

        <p className="mt-5 text-xs leading-5 text-[var(--cream-muted)]">
          Selfies and ID images stay with Veriff&apos;s process. MenRush never shows your legal name or documents to other members.
        </p>
      </main>
    </Layout>
  );
}
