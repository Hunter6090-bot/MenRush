import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verifyAPI, type IdDocumentType } from '../api/verify';
import { IdCaptureModal } from '../components/IdCaptureModal';
import { IdDocumentUploadButton } from '../components/IdDocumentUploadButton';
import { PulseRing } from '../components/PulseRing';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import {
  publicErrorClass,
  publicMutedCopyClass,
  publicPanelClass,
  publicPrimaryButtonClass,
  publicSecondaryButtonClass,
} from '../lib/publicStyles';

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

  const heroCopy =
    step === 'done'
      ? 'Return to your computer to take your live selfie and finish verification.'
      : step === 'uploading'
        ? 'Uploading your ID securely…'
        : 'Use your phone camera or upload a photo of your ID. Text must be readable.';

  return (
    <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.verifyScan} homeTo="/coming-soon">
      <PublicAuthHero title="Scan your" accent="ID." copy={heroCopy} />

      <div className={publicPanelClass}>
        {step === 'loading' ? (
          <div className={`flex items-center justify-center gap-2 py-6 ${publicMutedCopyClass}`}>
            <PulseRing size={18} />
            Preparing scanner…
          </div>
        ) : null}

        {step === 'front' && !captureOpen ? (
          <>
            <p className={`m-0 text-center ${publicMutedCopyClass}`}>
              {idType === 'passport'
                ? 'Photograph your passport photo page'
                : 'Step 1 of 2 — front of your licence'}
            </p>
            {nationality ? (
              <p className="m-0 text-center text-xs text-[#6B5840]">
                Document from <span className="text-[#C4832A]">{nationality}</span>
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setCaptureSide('front');
                setCaptureOpen(true);
              }}
              className={publicPrimaryButtonClass}
            >
              {idFront ? 'Retake front with camera' : 'Use camera'}
            </button>
            <IdDocumentUploadButton
              filePrefix="id-front"
              onCapture={handleFrontCapture}
              onError={setError}
              className={publicSecondaryButtonClass}
            />
          </>
        ) : null}

        {step === 'back' && !captureOpen ? (
          <>
            <p className={`m-0 text-center ${publicMutedCopyClass}`}>Step 2 of 2 — back of your licence</p>
            <button
              type="button"
              onClick={() => {
                setCaptureSide('back');
                setCaptureOpen(true);
              }}
              className={publicPrimaryButtonClass}
            >
              {idBack ? 'Retake back with camera' : 'Use camera for back'}
            </button>
            <IdDocumentUploadButton
              filePrefix="id-back"
              label="Upload back photo from device"
              onCapture={handleBackCapture}
              onError={setError}
              className={publicSecondaryButtonClass}
            />
          </>
        ) : null}

        {step === 'uploading' ? (
          <div className={`flex flex-col items-center gap-3 py-6 ${publicMutedCopyClass}`}>
            <PulseRing size={22} />
            Uploading…
          </div>
        ) : null}

        {step === 'done' ? (
          <p className="m-0 text-center text-sm font-semibold text-[#C4832A]">ID captured successfully</p>
        ) : null}

        {step === 'error' ? <p className={publicErrorClass}>{error ?? 'Something went wrong.'}</p> : null}

        {error && step !== 'error' ? <p className={publicErrorClass}>{error}</p> : null}
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
    </PublicAuthShell>
  );
};

export default VerifyScan;
