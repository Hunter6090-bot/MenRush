import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAPI, type IdDocumentType } from '../api/verify';
import { useAuthStore } from '../hooks/store';
import { useSocket } from '../hooks/useSocket';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';
import { SelfieCaptureModal } from '../components/SelfieCaptureModal';
import { IdCaptureModal } from '../components/IdCaptureModal';
import { VerificationQr } from '../components/VerificationQr';
import { NATIONALITIES } from '../lib/nationalities';
import { isPhoneDevice } from '../lib/device';
import { consumePostAuthRedirect } from '../lib/profileLinks';
import { trackEvent } from '../observability/analytics';

type Step = 'intro' | 'country' | 'id-type' | 'id-front' | 'id-back' | 'selfie';

export const Verify: React.FC = () => {
  const navigate = useNavigate();
  const setVerified = useAuthStore((s) => s.setVerified);

  const [step, setStep] = useState<Step>('intro');
  const [idType, setIdType] = useState<IdDocumentType | null>(null);
  const [nationality, setNationality] = useState('United Kingdom');
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [captureTarget, setCaptureTarget] = useState<'id-front' | 'id-back' | null>(null);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoffSessionId, setHandoffSessionId] = useState<string | null>(null);
  const [handoffReady, setHandoffReady] = useState(false);
  const [useLocalCamera, setUseLocalCamera] = useState(isPhoneDevice());
  const [handoffLoading, setHandoffLoading] = useState(false);

  const socket = useSocket();
  const prefersPhoneScan = !isPhoneDevice();
  const showPhoneQr = prefersPhoneScan && !useLocalCamera;

  const handoffUrl = useMemo(() => {
    if (!handoffSessionId || typeof window === 'undefined') return '';
    return `${window.location.origin}/verify/scan/${handoffSessionId}`;
  }, [handoffSessionId]);

  const isLicense = idType === 'driving_license';
  const totalIdSteps = isLicense ? 2 : 1;

  const stepIndex: Record<Step, number> = {
    intro: 0,
    country: 1,
    'id-type': 2,
    'id-front': 3,
    'id-back': isLicense ? 4 : 3,
    selfie: isLicense ? 5 : 4,
  };
  const totalSteps = isLicense ? 5 : 4;
  const currentStep = stepIndex[step];

  const handleIdFrontCapture = (file: File) => {
    setIdFront(file);
    setIdFrontPreview(URL.createObjectURL(file));
    setError(null);
    setCaptureTarget(null);
    setStep(isLicense ? 'id-back' : 'selfie');
  };

  const handleIdBackCapture = (file: File) => {
    setIdBack(file);
    setIdBackPreview(URL.createObjectURL(file));
    setError(null);
    setCaptureTarget(null);
    setStep('selfie');
  };

  const handleSelfieCapture = (file: File) => {
    setSelfie(file);
    setError(null);
  };

  useEffect(() => {
    if (step !== 'id-front' && step !== 'selfie') {
      setHandoffSessionId(null);
      setHandoffReady(false);
      setHandoffLoading(false);
    }
  }, [step]);

  useEffect(() => {
    if (!showPhoneQr || step !== 'id-front' || !idType || handoffSessionId || handoffLoading) {
      return;
    }

    let cancelled = false;
    setHandoffLoading(true);
    setError(null);

    verifyAPI
      .createHandoff(nationality, idType)
      .then((res) => {
        if (cancelled) return;
        setHandoffSessionId(res.data.session_id);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not start phone scanning. Try again or use this device\'s camera.');
        setUseLocalCamera(true);
      })
      .finally(() => {
        if (!cancelled) setHandoffLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showPhoneQr, step, idType, nationality, handoffSessionId, handoffLoading]);

  useEffect(() => {
    if (!socket || !handoffSessionId) return;

    const onHandoff = (payload: {
      session_id?: string;
      status?: string;
    }) => {
      if (payload.session_id !== handoffSessionId || payload.status !== 'doc_captured') return;
      setHandoffReady(true);
      setIdFront({} as File);
      if (isLicense) setIdBack({} as File);
      setError(null);
      setStep('selfie');
    };

    socket.on('verify:handoff', onHandoff);
    return () => {
      socket.off('verify:handoff', onHandoff);
    };
  }, [socket, handoffSessionId, isLicense]);

  useEffect(() => {
    if (!handoffSessionId || handoffReady || step === 'selfie') return;

    const poll = window.setInterval(() => {
      verifyAPI
        .getHandoff(handoffSessionId)
        .then((res) => {
          if (res.data.status !== 'doc_captured') return;
          setHandoffReady(true);
          setIdFront({} as File);
          if (isLicense) setIdBack({} as File);
          setError(null);
          setStep('selfie');
        })
        .catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(poll);
  }, [handoffSessionId, handoffReady, step, isLicense]);

  const handleSubmit = async () => {
    const hasIdViaHandoff = Boolean(handoffSessionId && handoffReady);
    if ((!idFront && !hasIdViaHandoff) || !selfie || !idType || !nationality) {
      setError('Complete every step before submitting.');
      return;
    }
    if (isLicense && !idBack && !hasIdViaHandoff) {
      setError('Driving licence requires front and back photos.');
      return;
    }

    trackEvent('verification_transition', { state: 'submit_requested' });
    setError(null);
    setLoading(true);

    try {
      const res = await verifyAPI.submit({
        idFront: hasIdViaHandoff ? undefined : idFront ?? undefined,
        selfie,
        idType,
        nationality,
        idBack: hasIdViaHandoff ? undefined : isLicense ? idBack ?? undefined : undefined,
        handoffSessionId: hasIdViaHandoff ? handoffSessionId ?? undefined : undefined,
      });
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
      if (!err?.response) {
        setError('Could not reach the server. Is the backend running? Try again in a moment.');
      } else {
        const code = err?.response?.data?.error;
        if (code === 'already_verified') {
          setVerified('verified', true);
          navigate(consumePostAuthRedirect('/discover'));
          return;
        } else if (code === 'document_already_used') {
          setError('This government ID is already linked to another MenRush account.');
        } else if (code === 'invalid_file_signature') {
          setError('One of the images was invalid. Use a JPG or PNG photo.');
        } else if (code === 'missing_license_fields') {
          setError('Driving licence requires front, back, and country.');
        } else if (code === 'missing_nationality' || code === 'invalid_id_type' || code === 'missing_files') {
          setError('Something was missing from your submission. Go back and complete every step.');
        } else {
          setError('Could not submit verification. Try again in a moment.');
        }
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
            Identity verification
          </h1>

          {step !== 'intro' ? (
            <div className="mb-5">
              <div className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A89070] mb-1.5">
                <span>Step {currentStep} of {totalSteps}</span>
                <span>Secure scan</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#3D2B0E]">
                <div
                  className="h-full bg-[#C4832A] transition-all duration-300"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          ) : null}

          {step === 'intro' ? (
            <>
              <div className="mb-5 rounded-xl border border-[#3D2B0E]/80 bg-[#0D0A06]/45 px-4 py-3.5">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#C4832A]">
                  Why we verify
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#F0E0C0]/88">
                  We verify every member to keep MenRush clean — no scammers, fakers, or
                  time-wasters. Real men, real IDs, real connections.
                </p>
              </div>

              <div className="mb-5 rounded-xl border border-[#3D2B0E]/80 bg-[#0D0A06]/45 px-4 py-3.5">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#C4832A]">
                  Your privacy
                </p>
                <ul className="mt-2 space-y-2 text-xs text-[#F0E0C0]/88">
                  <Bullet>Your ID is visible only to you and our automated matching system</Bullet>
                  <Bullet>
                    Automated face match first; unclear cases are reviewed by our team only
                  </Bullet>
                  <Bullet>We never sell, share, or display your ID on your profile</Bullet>
                </ul>
              </div>

              <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#A89070]">
                What you&apos;ll need
              </p>
              <ul className="space-y-2.5 mb-6 text-xs text-[#F0E0C0]/85">
                <Bullet>Passport or driving licence from your country</Bullet>
                <Bullet>Licence holders: front, then back</Bullet>
                <Bullet>Live selfie for automated face match</Bullet>
              </ul>
              <button
                type="button"
                onClick={() => setStep('country')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
              >
                Start verification
              </button>
            </>
          ) : null}

          {step === 'country' ? (
            <>
              <p className="text-sm text-[#A89070] mb-4 text-center">
                Which country issued your ID?
              </p>
              <label className="mb-5 block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-[#A89070]">
                  Country
                </span>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/80 px-3 py-2.5 text-sm text-[#F0E0C0] focus:border-[#C4832A]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25"
                >
                  {NATIONALITIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setStep('id-type')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
              >
                Continue
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

          {step === 'id-type' ? (
            <>
              <p className="text-sm text-[#A89070] mb-1 text-center">
                Document for <span className="font-semibold text-[#C4832A]">{nationality}</span>
              </p>
              <p className="text-sm text-[#A89070] mb-4 text-center">
                Which document are you using?
              </p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <DocTypeButton
                  active={idType === 'passport'}
                  onClick={() => setIdType('passport')}
                  label="Passport"
                />
                <DocTypeButton
                  active={idType === 'driving_license'}
                  onClick={() => setIdType('driving_license')}
                  label="Driving licence"
                />
              </div>

              <button
                type="button"
                disabled={!idType}
                onClick={() => setStep('id-front')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] disabled:opacity-50 text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setStep('country')}
                className="w-full mt-3 text-sm text-[#A89070] hover:text-[#C4832A]"
              >
                Back
              </button>
            </>
          ) : null}

          {step === 'id-front' ? (
            <>
              {showPhoneQr ? (
                <>
                  <p className="text-sm text-[#A89070] mb-4 text-center">
                    Scan the QR code with your phone to photograph your ID using its rear camera.
                  </p>
                  {handoffLoading || !handoffUrl ? (
                    <div className="mb-4 flex items-center justify-center gap-2 py-8 text-sm text-[#A89070]">
                      <PulseRing size={18} />
                      Generating QR code…
                    </div>
                  ) : (
                    <VerificationQr url={handoffUrl} className="mb-4" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setUseLocalCamera(true);
                      setHandoffSessionId(null);
                      setHandoffReady(false);
                    }}
                    className="w-full py-3 rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/80 text-[#F0E0C0] font-semibold text-sm"
                  >
                    Use this device&apos;s camera instead
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#A89070] mb-4 text-center">
                    {idType === 'passport'
                      ? 'Photograph your passport photo page'
                      : `Step 1 of ${totalIdSteps} — front of your licence`}
                  </p>
                  {idFrontPreview ? (
                    <div className="mb-4 rounded-xl overflow-hidden border border-[#3D2B0E]">
                      <img src={idFrontPreview} alt="ID front preview" className="w-full h-36 object-cover" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCaptureTarget('id-front')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
                  >
                    {idFront ? 'Rescan document' : 'Scan document'}
                  </button>
                  {idFront ? (
                    <button
                      type="button"
                      onClick={() => setStep(isLicense ? 'id-back' : 'selfie')}
                      className="w-full mt-3 py-3 rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/80 text-[#F0E0C0] font-semibold text-sm"
                    >
                      Continue
                    </button>
                  ) : null}
                </>
              )}
              <button
                type="button"
                onClick={() => setStep('id-type')}
                className="w-full mt-3 text-sm text-[#A89070] hover:text-[#C4832A]"
              >
                Back
              </button>
            </>
          ) : null}

          {step === 'id-back' ? (
            <>
              <p className="text-sm text-[#A89070] mb-4 text-center">
                Step 2 of 2 — back of your licence
              </p>
              {idBackPreview ? (
                <div className="mb-4 rounded-xl overflow-hidden border border-[#3D2B0E]">
                  <img src={idBackPreview} alt="ID back preview" className="w-full h-36 object-cover" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setCaptureTarget('id-back')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
              >
                {idBack ? 'Rescan back' : 'Scan back of licence'}
              </button>
              {idBack ? (
                <button
                  type="button"
                  onClick={() => setStep('selfie')}
                  className="w-full mt-3 py-3 rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/80 text-[#F0E0C0] font-semibold text-sm"
                >
                  Continue
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setStep('id-front')}
                className="w-full mt-3 text-sm text-[#A89070] hover:text-[#C4832A]"
              >
                Back
              </button>
            </>
          ) : null}

          {step === 'selfie' ? (
            <>
              <p className="text-sm text-[#A89070] mb-4 text-center">
                Final step — live selfie to match your ID photo
              </p>

              {handoffReady ? (
                <p className="mb-3 text-center text-xs font-semibold text-[#C4832A]">
                  ID received from your phone — take your selfie here to finish.
                </p>
              ) : null}

              {idFrontPreview ? (
                <div className="mb-3 rounded-xl overflow-hidden border border-[#3D2B0E]">
                  <img src={idFrontPreview} alt="ID preview" className="w-full h-28 object-cover" />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setSelfieOpen(true)}
                className="w-full py-3 rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/80 hover:border-[#C4832A]/60 text-[#F0E0C0] font-semibold text-sm"
              >
                {selfie ? 'Retake live selfie' : 'Start live selfie scan'}
              </button>

              {selfie ? (
                <p className="text-xs text-[#C4832A] text-center mt-3">Selfie captured.</p>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  loading
                  || (!idFront && !handoffReady)
                  || !selfie
                  || (isLicense && !idBack && !handoffReady)
                }
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] disabled:opacity-50 text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <PulseRing size={16} /> Matching your ID — may take a minute…
                  </>
                ) : (
                  'Submit verification'
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(isLicense ? 'id-back' : 'id-front')}
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
            Your ID is used only to confirm you are a real adult. No human at MenRush will
            access, sell, or share it.
          </p>
        </div>
      </div>

      <IdCaptureModal
        open={captureTarget === 'id-front'}
        onClose={() => setCaptureTarget(null)}
        onCapture={handleIdFrontCapture}
        onError={setError}
        template={idType === 'passport' ? 'passport' : 'driving_license_front'}
        ariaLabel={idType === 'passport' ? 'Photograph your passport' : 'Photograph licence front'}
        filePrefix="id-front"
      />

      <IdCaptureModal
        open={captureTarget === 'id-back'}
        onClose={() => setCaptureTarget(null)}
        onCapture={handleIdBackCapture}
        onError={setError}
        template="driving_license_back"
        ariaLabel="Photograph licence back"
        filePrefix="id-back"
      />

      <SelfieCaptureModal
        variant="verification"
        open={selfieOpen}
        onClose={() => setSelfieOpen(false)}
        onCapture={handleSelfieCapture}
        onError={setError}
      />
    </div>
  );
};

const DocTypeButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({
  active,
  onClick,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
      active
        ? 'border-[#C4832A] bg-[#C4832A]/20 text-[#F0E0C0]'
        : 'border-[#3D2B0E] bg-[#0D0A06]/80 text-[#A89070] hover:border-[#C4832A]/50'
    }`}
  >
    {label}
  </button>
);

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
