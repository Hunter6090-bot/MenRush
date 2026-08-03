import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SelfieCaptureModal } from '../components/SelfieCaptureModal';
import { verifyAPI, type AuthenticityChallenge } from '../api/verify';

export function AuthenticityVerify() {
  const [challenge, setChallenge] = useState<AuthenticityChallenge | null>(null);
  const [frames, setFrames] = useState<File[]>([]);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    verifyAPI.createAuthenticityChallenge()
      .then((res) => setChallenge(res.data))
      .catch(() => setError('Could not create a live challenge. Try again.'))
      .finally(() => setLoading(false));
  }, []);

  const prompt = challenge?.prompts[frames.length] ?? '';

  const capture = (file: File) => {
    setFrames((current) => {
      if (retakeIndex === null) return [...current, file];
      return current.map((frame, index) => index === retakeIndex ? file : frame);
    });
    setRetakeIndex(null);
    setCameraOpen(false);
    setError('');
  };

  const retake = (index: number) => {
    setRetakeIndex(index);
    setCameraOpen(true);
  };

  const submit = async () => {
    if (!challenge || frames.length !== challenge.prompts.length) return;
    setLoading(true);
    setError('');
    try {
      await verifyAPI.submitAuthenticityChallenge(challenge.challenge_id, frames);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error === 'challenge_invalid_or_expired'
        ? 'That challenge expired. Return to the Trust centre and start again.'
        : 'Could not submit the challenge. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--copper)]">Authentic person</p>
        <h1 className="mt-2 font-display text-3xl font-black text-[var(--cream)]">Live camera challenge</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--cream-muted)]">
          Follow three random prompts. Camera capture is required; no government ID or public legal name is involved.
        </p>

        {error ? <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}

        {submitted ? (
          <section className="mr-card mt-6 p-5">
            <h2 className="font-bold text-[var(--cream)]">All 3 photos received</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cream-muted)]">
              Your upload is complete. This does not mean the challenge has passed yet. A reviewer will check
              that each photo matches its assigned instruction.
            </p>
            <p className="mt-3 rounded-xl border border-[var(--border-default)] bg-black/10 p-3 text-xs leading-5 text-[var(--cream-muted)]">
              Next status: <strong className="text-[var(--cream)]">Confirmed</strong> if the instructions match,
              or <strong className="text-[var(--cream)]">Try again</strong> with a reason if they do not.
            </p>
            <Link to="/verify" className="mt-4 inline-flex text-sm font-bold text-[var(--copper)]">Back to Trust centre</Link>
          </section>
        ) : challenge ? (
          <section className="mr-card mt-6 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--cream-muted)]">Prompt {Math.min(frames.length + 1, 3)} of 3</p>
            <p className="mt-3 text-xl font-bold text-[var(--cream)]">{frames.length < 3 ? prompt : 'All three captures are ready.'}</p>
            <div className="mt-4 flex gap-2" aria-label={`${frames.length} of 3 prompts captured`}>
              {[0, 1, 2].map((index) => <span key={index} className={`h-2 flex-1 rounded-full ${index < frames.length ? 'bg-[var(--copper)]' : 'bg-[var(--border-default)]'}`} />)}
            </div>
            {frames.length < 3 ? (
              <button type="button" onClick={() => setCameraOpen(true)} className="mt-5 w-full rounded-xl bg-[var(--copper)] py-3 text-sm font-bold text-[#0D0A06]">
                Open camera for this prompt
              </button>
            ) : (
              <div className="mt-5">
                <p className="text-sm font-bold text-[var(--cream)]">Check each photo before submitting</p>
                <p className="mt-1 text-xs leading-5 text-[var(--cream-muted)]">
                  “Photo received” confirms the upload only. Make sure your pose visibly matches the instruction.
                </p>
                <ul className="mt-3 space-y-2">
                  {challenge.prompts.map((challengePrompt, index) => (
                    <li key={`${challengePrompt}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--cream)]">{index + 1}. {challengePrompt}</p>
                        <p className="mt-0.5 text-[11px] text-[#86EFAC]">✓ Photo received — not reviewed yet</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => retake(index)}
                        className="shrink-0 rounded-lg border border-[var(--copper)]/50 px-3 py-1.5 text-xs font-bold text-[var(--copper)]"
                      >
                        Retake
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={submit} disabled={loading} className="mt-4 w-full rounded-xl bg-[var(--copper)] py-3 text-sm font-bold text-[#0D0A06] disabled:opacity-50">
                  {loading ? 'Submitting…' : 'Submit all 3 for review'}
                </button>
              </div>
            )}
          </section>
        ) : loading ? <p className="mt-6 text-sm text-[var(--cream-muted)]">Preparing challenge…</p> : null}
      </main>

      <SelfieCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={capture}
        onError={setError}
        instruction={retakeIndex === null ? prompt : challenge?.prompts[retakeIndex] ?? prompt}
        ariaLabel={`Authenticity prompt: ${retakeIndex === null ? prompt : challenge?.prompts[retakeIndex] ?? prompt}`}
        filePrefix={`authenticity-${(retakeIndex ?? frames.length) + 1}`}
      />
    </Layout>
  );
}
