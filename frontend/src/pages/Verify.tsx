import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAPI } from '../api/verify';
import { useAuthStore } from '../hooks/store';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { SelfieCaptureModal } from '../components/SelfieCaptureModal';
import { consumePostAuthRedirect } from '../lib/profileLinks';
import { trackEvent } from '../observability/analytics';

type Step = 'intro' | 'id' | 'selfie';

export const Verify: React.FC = () => {
  const navigate = useNavigate();
  const setVerified = useAuthStore((s) => s.setVerified);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('intro');
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIdSelect = (file: File | null) => {
    if (!file) return;
    setIdFront(file);
    setIdPreview(URL.createObjectURL(file));
    setError(null);
    setStep('selfie');
  };

  const handleSelfieCapture = (file: File) => {
    setSelfie(file);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!idFront || !selfie) {
      setError('Upload your ID and take a selfie to continue.');
      return;
    }

    trackEvent('verification_transition', { state: 'submit_requested' });
    setError(null);
    setLoading(true);

    try {
      const res = await verifyAPI.submit(idFront, selfie);
      const { status } = res.data;

      if (status === 'verified') {
        setVerified('verified', true);
        trackEvent('verification_transition', { state: 'verified' });
        navigate(consumePostAuthRedirect('/discover'));
        return;
      }

      if (status === 'rejected') {
        setVerified('rejected', false);
        trackEvent('verification_transition', { state: 'rejected' });
        navigate('/verify/rejected');
        return;
      }

      setVerified('pending', false);
      trackEvent('verification_transition', { state: 'submitted' });
      navigate('/verify/pending');
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'already_verified') {
        setVerified('verified', true);
        navigate(consumePostAuthRedirect('/discover'));
      } else if (code === 'document_already_used') {
        setError('This government ID is already linked to another MenRush account.');
      } else if (code === 'invalid_file_signature') {
        setError('One of the images was invalid. Use a JPG or PNG photo.');
      } else {
        setError('Could not submit verification. Try again in a moment.');
      }
      trackEvent('verification_transition', { state: 'submit_failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden flex items-center justify-center p-4">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="bg-[#1E1508]/85 backdrop-blur-xl border border-[#3D2B0E] rounded-2xl p-7 shadow-card text-[#F0E0C0]">
          <div className="flex justify-center mb-5">
            <ShieldIcon className="w-14 h-14 text-[#C4832A]" />
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight mb-2">
            Verify your identity
          </h1>
          <p className="text-sm text-[#A89070] text-center leading-relaxed mb-6">
            MenRush is 100% government-ID verified. Upload your ID, take a live selfie,
            and we match your face to the photo on your document.
          </p>

          {step === 'intro' ? (
            <>
              <ul className="space-y-2.5 mb-6 text-xs text-[#F0E0C0]/85">
                <Bullet>Driving license, passport, or national ID card</Bullet>
                <Bullet>Clear photo of the ID front with your face visible</Bullet>
                <Bullet>Live selfie — we compare it to your ID photo</Bullet>
                <Bullet>ID images are stored privately and never shown on your profile</Bullet>
              </ul>
              <button
                type="button"
                onClick={() => setStep('id')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
              >
                Start verification
              </button>
            </>
          ) : null}

          {step === 'id' ? (
            <>
              <p className="text-sm text-[#A89070] mb-4 text-center">
                Step 1 of 2 — photograph the front of your government ID.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => handleIdSelect(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/80 hover:border-[#C4832A]/60 text-[#F0E0C0] font-semibold text-sm"
              >
                Upload ID photo
              </button>
              <button
                type="button"
                onClick={() => setStep('intro')}
                className="w-full mt-3 text-sm text-[#A89070] hover:text-[#C4832A]"
              >
                Back
              </button>
            </>
          ) : null}

          {step === 'selfie' ? (
            <>
              <p className="text-sm text-[#A89070] mb-4 text-center">
                Step 2 of 2 — take a live selfie so we can match your face to your ID.
              </p>

              {idPreview ? (
                <div className="mb-4 rounded-xl overflow-hidden border border-[#3D2B0E]">
                  <img src={idPreview} alt="ID preview" className="w-full h-36 object-cover" />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setSelfieOpen(true)}
                className="w-full py-3 rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/80 hover:border-[#C4832A]/60 text-[#F0E0C0] font-semibold text-sm"
              >
                {selfie ? 'Retake selfie' : 'Take selfie'}
              </button>

              {selfie ? (
                <p className="text-xs text-[#C4832A] text-center mt-3">Selfie captured.</p>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !idFront || !selfie}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] disabled:opacity-50 text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <PulseRing size={16} /> Checking your ID and selfie…
                  </>
                ) : (
                  'Submit verification'
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('id')}
                className="w-full mt-3 text-sm text-[#A89070] hover:text-[#C4832A]"
              >
                Back
              </button>
            </>
          ) : null}

          {error ? (
            <div className="mt-4 px-3 py-2.5 rounded-lg bg-[#8B4513]/15 border border-[#8B4513]/30 text-xs text-[#F0E0C0]/90">
              {error}
            </div>
          ) : null}

          <p className="text-[11px] text-[#A89070]/70 text-center mt-5 leading-snug">
            Your ID is used only to confirm you are a real adult. We never publish it.
          </p>
        </div>
      </div>

      <SelfieCaptureModal
        open={selfieOpen}
        onClose={() => setSelfieOpen(false)}
        onCapture={handleSelfieCapture}
        onError={setError}
      />
    </div>
  );
};

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2">
    <span className="text-[#C4832A] mt-0.5">•</span>
    <span>{children}</span>
  </li>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path
      d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6l8-3z"
      strokeLinejoin="round"
    />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Verify;