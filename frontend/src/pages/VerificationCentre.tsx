import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { verifyAPI, type VerifyStatus } from '../api/verify';

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

  const authentic = state?.authenticity_status === 'verified' || state?.is_verified;
  const identity = Boolean(state?.is_verified);
  const adult = state?.age_assurance_status === 'confirmed';

  return (
    <Layout>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--copper)]">Trust centre</p>
        <h1 className="mt-2 font-display text-3xl font-black text-[var(--cream)]">Verification, without giving up discretion</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--cream-muted)]">
          Your membership plan and trust status are separate. Optional checks never reveal your legal name or documents to other members.
        </p>

        {error ? <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}

        <div className="mt-6 space-y-3">
          <section className="mr-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-[var(--cream)]">Adult confirmed</h2>
                <p className="mt-1 text-sm leading-5 text-[var(--cream-muted)]">
                  The mandatory 18+ assurance baseline. Date-of-birth entry alone is not presented as a completed legal age check.
                </p>
              </div>
              <StatusPill label={adult ? 'Confirmed' : state?.age_assurance_status === 'self_attested' ? 'DOB supplied' : 'Pending'} complete={adult} />
            </div>
          </section>

          <section className="mr-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-[var(--cream)]">Authentic person</h2>
                <p className="mt-1 text-sm leading-5 text-[var(--cream-muted)]">
                  Optional live randomised camera challenge. No government ID is needed.
                </p>
              </div>
              <StatusPill label={authentic ? 'Confirmed' : state?.authenticity_status === 'pending' ? 'In review' : 'Optional'} complete={Boolean(authentic)} />
            </div>
            {!authentic && state?.authenticity_status !== 'pending' ? (
              <Link to="/verify/authentic" className="mt-4 inline-flex rounded-xl bg-[var(--copper)] px-4 py-2.5 text-sm font-bold text-[#0D0A06]">
                Start live challenge
              </Link>
            ) : null}
          </section>

          <section className="mr-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-[var(--cream)]">Identity checked</h2>
                <p className="mt-1 text-sm leading-5 text-[var(--cream-muted)]">
                  Optional government ID privately matched to a live selfie. This earns the strongest trust badge.
                </p>
              </div>
              <StatusPill label={identity ? 'Confirmed' : state?.status === 'pending' ? 'In review' : 'Optional'} complete={identity} />
            </div>
            {!identity && state?.status !== 'pending' ? (
              <Link to="/verify/id" className="mt-4 inline-flex rounded-xl border border-[var(--copper)]/60 px-4 py-2.5 text-sm font-bold text-[var(--copper)]">
                Check my identity
              </Link>
            ) : null}
          </section>
        </div>

        <p className="mt-5 text-xs leading-5 text-[var(--cream-muted)]">
          Selfies and ID images are sensitive review material and are removed after review, with a 72-hour maximum retention target.
        </p>
      </main>
    </Layout>
  );
}
