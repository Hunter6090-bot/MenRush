import { useCallback, useEffect, useRef, useState } from 'react';
import { verifyAPI, type IdPrecheckResult } from '../api/verify';
import { assessFrameQuality, captureDocumentRegion } from '../lib/captureQuality';
import { DocumentScannerOverlay } from './DocumentScannerOverlay';

export type IdDocumentTemplate = 'passport' | 'driving_license_front' | 'driving_license_back';

/** Consecutive aligned frames before snap (anti-flicker only — not a hold timer). */
const ALIGNED_FRAMES_TO_CAPTURE = 3;

interface IdCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onError: (message: string) => void;
  template: IdDocumentTemplate;
  ariaLabel?: string;
  filePrefix?: string;
  handoff?: { sessionId: string; token: string };
}

function templateLabel(template: IdDocumentTemplate): string {
  switch (template) {
    case 'passport':
      return 'Align your passport photo page inside the frame. All text must be readable.';
    case 'driving_license_front':
      return 'Align the front of your licence. Your photo on the ID must be visible.';
    case 'driving_license_back':
      return 'Flip your licence and align the back inside the frame.';
  }
}

type PrecheckPhase = 'idle' | 'checking' | 'done' | 'error';

export function IdCaptureModal({
  open,
  onClose,
  onCapture,
  onError,
  template,
  ariaLabel = 'Scan your ID',
  filePrefix = 'id',
  handoff,
}: IdCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const alignedFramesRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onCaptureRef = useRef(onCapture);
  const captureFrameRef = useRef<() => void>(() => undefined);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'camera' | 'preview'>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [qualityMsg, setQualityMsg] = useState('Starting camera…');
  const [qualityOk, setQualityOk] = useState(false);
  const [precheckPhase, setPrecheckPhase] = useState<PrecheckPhase>('idle');
  const [precheckResult, setPrecheckResult] = useState<IdPrecheckResult | null>(null);
  const precheckRequestRef = useRef(0);

  useEffect(() => {
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    onCaptureRef.current = onCapture;
  }, [onClose, onCapture, onError]);

  useEffect(() => {
    if (!open) {
      setReady(false);
      setPhase('camera');
      setPreviewUrl(null);
      setPreviewFile(null);
      setQualityMsg('Starting camera…');
      setQualityOk(false);
      setPrecheckPhase('idle');
      setPrecheckResult(null);
      alignedFramesRef.current = 0;
    }
  }, [open]);

  useEffect(() => {
    if (!open || phase !== 'camera') {
      setReady(false);
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current('ID scan needs HTTPS and camera access.');
      onCloseRef.current();
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().then(() => setReady(true)).catch(() => {
            onErrorRef.current('Could not start the camera preview.');
            onCloseRef.current();
          });
        }
      })
      .catch((error: DOMException) => {
        onErrorRef.current(
          error?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow camera to scan your ID.'
            : 'Could not open the camera.',
        );
        onCloseRef.current();
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [open, phase]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready || video.videoWidth === 0) return;

    const docTemplate = template === 'passport' ? 'passport' : 'licence';
    const canvas = captureDocumentRegion(video, docTemplate);
    if (!canvas) {
      onErrorRef.current('Could not capture the scan.');
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onErrorRef.current('Could not capture the scan.');
          return;
        }
        const file = new File([blob], `${filePrefix}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPreviewFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase('preview');
        setPrecheckPhase('idle');
        setPrecheckResult(null);
        alignedFramesRef.current = 0;
      },
      'image/jpeg',
      0.94,
    );
  }, [filePrefix, ready, template]);

  useEffect(() => {
    captureFrameRef.current = captureFrame;
  }, [captureFrame]);

  useEffect(() => {
    if (!open || phase !== 'camera' || !ready) return;

    const tick = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      const docTemplate = template === 'passport' ? 'passport' : 'licence';
      const q = assessFrameQuality(video, 'document', docTemplate);
      setQualityMsg(q.message);
      setQualityOk(q.ok);

      if (!q.ok) {
        alignedFramesRef.current = 0;
        return;
      }

      alignedFramesRef.current += 1;
      if (alignedFramesRef.current >= ALIGNED_FRAMES_TO_CAPTURE) {
        captureFrameRef.current();
      }
    }, 120);

    return () => window.clearInterval(tick);
  }, [open, phase, ready, template]);

  useEffect(() => {
    if (!open || phase !== 'preview' || !previewFile) return;

    const requestId = precheckRequestRef.current + 1;
    precheckRequestRef.current = requestId;
    setPrecheckPhase('checking');
    setPrecheckResult(null);

    const precheckRequest = handoff
      ? verifyAPI.handoffPrecheck(handoff.sessionId, handoff.token, previewFile, template)
      : verifyAPI.precheck(previewFile, template);

    precheckRequest
      .then((response) => {
        if (precheckRequestRef.current !== requestId) return;
        setPrecheckResult(response.data);
        setPrecheckPhase('done');
      })
      .catch(() => {
        if (precheckRequestRef.current !== requestId) return;
        setPrecheckPhase('error');
        setPrecheckResult({
          acceptable: false,
          source: 'local',
          checks: [],
          message: 'Could not verify this scan. Check your connection and try again.',
          rejectionReasons: ['Could not reach the ID check service.'],
        });
      });
  }, [open, phase, previewFile, template, handoff]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    alignedFramesRef.current = 0;
    setPrecheckPhase('idle');
    setPrecheckResult(null);
    setPhase('camera');
  };

  const handleUsePhoto = () => {
    if (!previewFile || !precheckResult?.acceptable) return;
    onCaptureRef.current(previewFile);
    onCloseRef.current();
  };

  const precheckReady = precheckPhase === 'done' && Boolean(precheckResult);
  const canConfirm = precheckReady && precheckResult?.acceptable === true;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-[#050403]"
      role="presentation"
    >
      <div className="flex items-center justify-between border-b border-[#3D2B0E]/80 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C4832A]">
          ID scanner
        </p>
        <button
          type="button"
          onClick={() => onCloseRef.current()}
          className="text-sm font-semibold text-[#A89070] hover:text-[#C4832A]"
        >
          Cancel
        </button>
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="relative mx-auto w-full max-w-lg flex-1"
      >
        <div className="relative h-full min-h-[60dvh] bg-black">
          {phase === 'camera' ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
              />
              <DocumentScannerOverlay mode="document" template={template} aligned={qualityOk} />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#A89070]">
                  Initialising scanner…
                </div>
              )}
              {ready ? (
                <div className="absolute inset-x-0 top-4 flex flex-col items-center gap-2 px-4">
                  <span
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                      qualityOk
                        ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/50'
                        : 'bg-[#EF4444]/15 text-[#FCA5A5] border border-[#EF4444]/45'
                    }`}
                  >
                    {qualityMsg}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            previewUrl && (
              <img src={previewUrl} alt="ID scan preview" className="absolute inset-0 h-full w-full object-contain bg-black p-4" />
            )
          )}
        </div>
      </div>

      <div className="border-t border-[#3D2B0E]/80 bg-[#0D0A06] px-4 py-4">
        <p className="mb-3 text-center text-xs leading-relaxed text-[#A89070]">
          {phase === 'preview'
            ? precheckPhase === 'checking'
              ? 'AI is checking whether this ID scan is acceptable…'
              : precheckResult?.acceptable
                ? 'ID scan accepted — confirm to continue'
                : 'This scan is not acceptable — rescan your ID'
            : templateLabel(template)}
        </p>

        {phase === 'preview' ? (
          <div className="mb-4">
            {precheckPhase === 'checking' ? (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#A89070]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3D2B0E] border-t-[#C4832A]" />
                Running ID acceptability checks…
              </div>
            ) : null}

            {precheckResult ? (
              <>
                <p
                  className={`mb-3 text-center text-xs font-semibold ${
                    precheckResult.acceptable ? 'text-[#22C55E]' : 'text-[#FCA5A5]'
                  }`}
                >
                  {precheckResult.message}
                </p>
                <ul className="space-y-1.5 text-[11px] text-[#D4C4A8]">
                  {precheckResult.checks.map((check) => (
                    <li key={check.id} className="flex gap-2">
                      <span className={check.passed ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                        {check.passed ? '✓' : '✕'}
                      </span>
                      <span>
                        <span className="font-semibold text-[#F0E0C0]">{check.label}</span>
                        {check.detail ? (
                          <span className="text-[#A89070]"> — {check.detail}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-center gap-3">
          {phase === 'preview' ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 rounded-xl border border-[#3D2B0E] py-3 text-sm font-semibold text-[#F0E0C0]"
              >
                Rescan
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                disabled={!canConfirm}
                className="flex-1 rounded-xl bg-[#C4832A] py-3 text-sm font-bold text-[#0D0A06] disabled:opacity-40"
              >
                {precheckPhase === 'checking' ? 'Checking…' : 'Confirm scan'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={captureFrame}
              disabled={!ready}
              className="w-full rounded-xl border border-[#3D2B0E] py-3 text-sm font-semibold text-[#F0E0C0] disabled:opacity-40"
            >
              Capture manually
            </button>
          )}
        </div>
      </div>
    </div>
  );
}