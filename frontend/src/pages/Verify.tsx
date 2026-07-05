import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAPI, type IdDocumentType } from '../api/verify';
import { useAuthStore } from '../hooks/store';
import { useSocket } from '../hooks/useSocket';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import { PulseRing } from '../components/PulseRing';
import { SelfieCaptureModal } from '../components/SelfieCaptureModal';
import { IdCaptureModal } from '../components/IdCaptureModal';
import { VerificationQr } from '../components/VerificationQr';
import { NATIONALITIES } from '../lib/nationalities';
import { isPhoneDevice } from '../lib/device';
import { consumePostAuthRedirect } from '../lib/profileLinks';
import { trackEvent } from '../observability/analytics';
import {
  publicBackButtonClass,
  publicDocTypeButtonClass,
  publicErrorClass,
  publicInfoBoxClass,
  publicLabelCopperClass,
  publicMutedCopyClass,
  publicPanelClass,
  publicPrimaryButtonClass,
  publicProgressFillClass,
  publicProgressTrackClass,
  publicSecondaryButtonClass,
  publicSelectClass,
} from '../lib/publicStyles';

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

  const heroForStep = (): { title: string; accent: string; copy: string } => {
    switch (step) {
      case 'intro':
        return {
          title: "Prove you're",
          accent: 'you.',
          copy:
            'Snap your ID, then a live selfie. We compare them for your copper checkmark. Verification is free — always.',
        };
      case 'country':
        return {
          title: 'Where was your',
          accent: 'ID issued?',
          copy: 'Select the country that issued your passport or driving licence.',
        };
      case 'id-type':
        return {
          title: 'Which document',
          accent: 'are you using?',
          copy: `Choose the ID you'll photograph for ${nationality}.`,
        };
      case 'id-front':
        return {
          title: 'Front of your',
          accent: 'ID.',
          copy: showPhoneQr
            ? 'Scan the QR with your phone, or use this device\'s camera.'
            : idType === 'passport'
              ? 'Photograph your passport photo page. Fill the frame, avoid glare.'
              : 'Step 1 — front of your licence. Fill the frame, avoid glare.',
        };
      case 'id-back':
        return {
          title: 'Back of your',
          accent: 'licence.',
          copy: 'Step 2 — photograph the back of your driving licence.',
        };
      case 'selfie':
        return {
          title: 'Live',
          accent: 'selfie.',
          copy: 'Hold steady, face the camera, no filters. We match this to your ID photo.',
        };
      default:
        return { title: 'Identity', accent: 'verification.', copy: '' };
    }
  };

  const hero = heroForStep();

  return (
    <>
      <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.verify} homeTo="/discover">
        <PublicAuthHero title={hero.title} accent={hero.accent} copy={hero.copy} />

        {step !== 'intro' ? (
          <div className="mb-5 mt-2">
            <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A89070]">
              <span>
                Step {currentStep} of {totalSteps}
              </span>
              <span>Secure scan</span>
            </div>
            <div className={publicProgressTrackClass}>
              <div
                className={publicProgressFillClass}
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className={publicPanelClass}>
          {step === 'intro' ? (
            <>
              <div className={publicInfoBoxClass}>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#E0A14A]">
                  Verified is free · always
                </p>
                <p className={`mt-2 ${publicMutedCopyClass}`}>
                  We verify every member to keep MenRush clean — no scammers, fakers, or time-wasters.
                </p>
              </div>

              <div className={publicInfoBoxClass}>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#E0A14A]">
                  Your privacy
                </p>
                <ul className="mt-2 space-y-2 text-xs text-[#F0E0C0]/88">
                  <Bullet>Documents auto-deleted after your badge is issued</Bullet>
                  <Bullet>Automated face match first; unclear cases reviewed by our team only</Bullet>
                  <Bullet>Other users only see the copper checkmark, never your ID</Bullet>
                </ul>
              </div>

              <ul className="space-y-2 text-xs text-[#F0E0C0]/85">
                <Bullet>Passport or driving licence from your country</Bullet>
                <Bullet>Licence holders: front, then back</Bullet>
                <Bullet>Live selfie for automated face match</Bullet>
              </ul>

              <button type="button" onClick={() => setStep('country')} className={publicPrimaryButtonClass}>
                Start verification
              </button>
              <p className="m-0 text-center text-[11px] text-[#A89070]/70">Takes about 60 seconds.</p>
            </>
          ) : null}

          {step === 'country' ? (
            <>
              <label className="flex flex-col gap-2.5">
                <span className={publicLabelCopperClass}>Country</span>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className={publicSelectClass}
                >
                  {NATIONALITIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setStep('id-type')} className={publicPrimaryButtonClass}>
                Continue
              </button>
              <button type="button" onClick={() => setStep('intro')} className={publicBackButtonClass}>
                Back
              </button>
            </>
          ) : null}

          {step === 'id-type' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
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
                className={publicPrimaryButtonClass}
              >
                Continue
              </button>
              <button type="button" onClick={() => setStep('country')} className={publicBackButtonClass}>
                Back
              </button>
            </>
          ) : null}

          {step === 'id-front' ? (
            <>
              {showPhoneQr ? (
                <>
                  {handoffLoading || !handoffUrl ? (
                    <div className={`flex items-center justify-center gap-2 py-8 ${publicMutedCopyClass}`}>
                      <PulseRing size={18} />
                      Generating QR code…
                    </div>
                  ) : (
                    <VerificationQr url={handoffUrl} className="mb-2" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setUseLocalCamera(true);
                      setHandoffSessionId(null);
                      setHandoffReady(false);
                    }}
                    className={publicSecondaryButtonClass}
                  >
                    Use this device&apos;s camera instead
                  </button>
                </>
              ) : (
                <>
                  {idFrontPreview ? (
                    <div className="overflow-hidden rounded-2xl border border-[rgba(240,224,192,0.2)]">
                      <img src={idFrontPreview} alt="ID front preview" className="h-36 w-full object-cover" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCaptureTarget('id-front')}
                    className={publicPrimaryButtonClass}
                  >
                    {idFront ? 'Rescan document' : 'Scan document'}
                  </button>
                  {idFront ? (
                    <button
                      type="button"
                      onClick={() => setStep(isLicense ? 'id-back' : 'selfie')}
                      className={publicSecondaryButtonClass}
                    >
                      Continue
                    </button>
                  ) : null}
                </>
              )}
              <button type="button" onClick={() => setStep('id-type')} className={publicBackButtonClass}>
                Back
              </button>
            </>
          ) : null}

          {step === 'id-back' ? (
            <>
              {idBackPreview ? (
                <div className="overflow-hidden rounded-2xl border border-[rgba(240,224,192,0.2)]">
                  <img src={idBackPreview} alt="ID back preview" className="h-36 w-full object-cover" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setCaptureTarget('id-back')}
                className={publicPrimaryButtonClass}
              >
                {idBack ? 'Rescan back' : 'Scan back of licence'}
              </button>
              {idBack ? (
                <button type="button" onClick={() => setStep('selfie')} className={publicSecondaryButtonClass}>
                  Continue
                </button>
              ) : null}
              <button type="button" onClick={() => setStep('id-front')} className={publicBackButtonClass}>
                Back
              </button>
            </>
          ) : null}

          {step === 'selfie' ? (
            <>
              {handoffReady ? (
                <p className="m-0 text-center text-xs font-semibold text-[#C4832A]">
                  ID received from your phone — take your selfie here to finish.
                </p>
              ) : null}

              {idFrontPreview ? (
                <div className="overflow-hidden rounded-2xl border border-[rgba(240,224,192,0.2)]">
                  <img src={idFrontPreview} alt="ID preview" className="h-28 w-full object-cover" />
                </div>
              ) : null}

              <button type="button" onClick={() => setSelfieOpen(true)} className={publicSecondaryButtonClass}>
                {selfie ? 'Retake live selfie' : 'Start live selfie scan'}
              </button>

              {selfie ? <p className="m-0 text-center text-xs text-[#C4832A]">Selfie captured.</p> : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  loading
                  || (!idFront && !handoffReady)
                  || !selfie
                  || (isLicense && !idBack && !handoffReady)
                }
                className={publicPrimaryButtonClass}
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
                className={publicBackButtonClass}
              >
                Back
              </button>
            </>
          ) : null}

          {error ? <p className={publicErrorClass}>{error}</p> : null}

          <p className="m-0 text-center text-[11px] leading-snug text-[#A89070]/70">
            Your ID is used only to confirm you are a real adult. No human at MenRush will access,
            sell, or share it.
          </p>
        </div>
      </PublicAuthShell>

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
    </>
  );
};

const DocTypeButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({
  active,
  onClick,
  label,
}) => (
  <button type="button" onClick={onClick} className={publicDocTypeButtonClass(active)}>
    {label}
  </button>
);

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2">
    <span className="mt-0.5 text-[#C4832A]">•</span>
    <span>{children}</span>
  </li>
);

export default Verify;
