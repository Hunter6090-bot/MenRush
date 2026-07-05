import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verifyAPI, type IdDocumentType } from '../api/verify';
import { IdCaptureModal } from '../components/IdCaptureModal';
import { RandomBackground } from '../components/RandomBackground';
import { PulseRing } from '../components/PulseRing';

type ScanStep = 'loading' | 'front' | 'back' | 'uploading' | 'done' | 'error';

const HANDOFF_TOKEN_KEY = 'verify_handoff_token';

export const VerifyScan: React.FC = () => {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const [step, setStep] = useState<ScanStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [nationality, setNationality] = useState('');
  const [idType, setIdType] = useState<IdDocumentType | null>(null);
  const [handoffToken, setHandoffToken] = useState<string | null>(null);
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureSide, setCaptureSide] = useState<'front' | 'back'>('front');

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid verification link.');
      setStep('error');
      return;
    }

    let cancelled = false;

    verifyAPI
      .claimHandoff(sessionId)
      .then((res) => {
        if (cancelled) return;
        setHandoffToken(res.data.handoff_token);
        setNationality(res.data.nationality);
        setIdType(res.data.id_type);
        sessionStorage.setItem(HANDOFF_TOKEN_KEY, res.data.handoff_token);
        setStep('front');
        setCaptureOpen(true);
        setCaptureSide('front');
      })
      .catch(() => {
        if (cancelled) return;
        setError('This verification link has expired or is no longer valid.');
        setStep('error');
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const uploadDocuments = useCallback(
    async (front: File, back: File | null) => {
      if (!handoffToken || !sessionId) return;
      setStep('uploading');
      setError(null);

      try {
        await verifyAPI.uploadHandoff(sessionId, handoffToken, {
          idFront: front,
          idBack: back ?? undefined,
        });
        setStep('done');
      } catch {
        setError('Could not upload your ID photos. Try scanning again.');
        setStep('front');
        setIdFront(null);
        setIdBack(null);
        setCaptureOpen(true);
        setCaptureSide('front');
      }
    },
    [handoffToken, sessionId],
  );

  const handleFrontCapture = (file: File) => {
    setIdFront(file);
    setCaptureOpen(false);
    setError(null);

    if (idType === 'driving_license') {
      setStep('back');
      setCaptureSide('back');
      setCaptureOpen(true);
      return;
    }

    void uploadDocuments(file, null);
  };

  const handleBackCapture = (file: File) => {
    setIdBack(file);
    setCaptureOpen(false);
    if (idFront) {
      void uploadDocuments(idFront, file);
    }
  };

  const handoff =
    handoffToken && sessionId ? { sessionId, token: handoffToken } : undefined;

  return (
    <div className="relative min-h-dvh overflow-hidden flex items-center justify-center p-4">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="bg-[#1E1508]/85 backdrop-blur-xl border border-[#3D2B0E] rounded-2xl p-7 shadow-card text-[#F0E0C0]">
          <div className="flex justify-center mb-5">
            <PhoneIcon className="w-12 h-12 text-[#C4832A]" />
          </div>

          <h1 className="text-2xl font-black text-center tracking-tight mb-2">
            Scan your ID
          </h1>

          {step === 'loading' ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#A89070]">
              <PulseRing size={18} />
              Preparing scanner…
            </div>
          ) : null}

          {step === 'front' && !captureOpen ? (
            <>
              <p className="text-sm text-[#A89070] mb-4 text-center">
                {idType === 'passport'
                  ? 'Photograph your passport photo page'
                  : 'Step 1 of 2 — front of your licence'}
              </p>
              {nationality ? (
                <p className="mb-4 text-center text-xs text-[#6B5840]">
                  Document from <span className="text-[#C4832A]">{nationality}</span>
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setCaptureSide('front');
                  setCaptureOpen(true);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
              >
                {idFront ? 'Rescan front' : 'Scan document'}
              </button>
            </>
          ) : null}

          {step === 'back' && !captureOpen ? (
            <>
              <p className="text-sm text-[#A89070] mb-4 text-center">
                Step 2 of 2 — back of your licence
              </p>
              <button
                type="button"
                onClick={() => {
                  setCaptureSide('back');
                  setCaptureOpen(true);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.98]"
              >
                {idBack ? 'Rescan back' : 'Scan back of licence'}
              </button>
            </>
          ) : null}

          {step === 'uploading' ? (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-[#A89070]">
              <PulseRing size={22} />
              Uploading your ID securely…
            </div>
          ) : null}

          {step === 'done' ? (
            <div className="py-4 text-center">
              <p className="text-sm font-semibold text-[#C4832A] mb-2">ID captured successfully</p>
              <p className="text-xs leading-relaxed text-[#A89070]">
                Return to your computer to take your live selfie and finish verification.
              </p>
            </div>
          ) : null}

          {step === 'error' ? (
            <div className="px-3 py-2.5 rounded-lg bg-[#8B4513]/15 border border-[#8B4513]/30 text-xs text-[#F0E0C0]/90 text-center">
              {error ?? 'Something went wrong.'}
            </div>
          ) : null}

          {error && step !== 'error' ? (
            <div className="mt-4 px-3 py-2.5 rounded-lg bg-[#8B4513]/15 border border-[#8B4513]/30 text-xs text-[#F0E0C0]/90">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <IdCaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={captureSide === 'front' ? handleFrontCapture : handleBackCapture}
        onError={setError}
        template={
          captureSide === 'back'
            ? 'driving_license_back'
            : idType === 'passport'
              ? 'passport'
              : 'driving_license_front'
        }
        ariaLabel={
          captureSide === 'back'
            ? 'Photograph licence back'
            : idType === 'passport'
              ? 'Photograph your passport'
              : 'Photograph licence front'
        }
        filePrefix={captureSide === 'back' ? 'id-back' : 'id-front'}
        handoff={handoff}
      />
    </div>
  );
};

const PhoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="7" y="2.5" width="10" height="19" rx="2" />
    <path d="M11 18.5h2" strokeLinecap="round" />
  </svg>
);

export default VerifyScan;