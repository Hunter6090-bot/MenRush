import { useCallback, useEffect, useRef, useState } from 'react';
import { verifyAPI, type IdPrecheckResult } from '../api/verify';
import { assessFrameQuality, captureDocumentRegion } from '../lib/captureQuality';
import { normalizeIdImageFile } from '../lib/imageUpload';
import { DocumentScannerOverlay } from './DocumentScannerOverlay';

export type IdDocumentTemplate = 'passport' | 'driving_license_front' | 'driving_license_back';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onCaptureRef = useRef(onCapture);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'camera' | 'preview'>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [qualityMsg, setQualityMsg] = useState('Starting camera…');
  const [qualityOk, setQualityOk] = useState(false);
  const [precheckPhase, setPrecheckPhase] = useState<PrecheckPhase>('idle');
  const [precheckResult, setPrecheckResult] = useState<IdPrecheckResult | null>(null);
  const [filePreparing, setFilePreparing] = useState(false);
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
      setFilePreparing(false);
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
          const markReady = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setReady(true);
            }
          };
          video.onloadedmetadata = markReady;
          void video.play().then(markReady).catch(() => {
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

  const showPreview = useCallback((file: File, url: string) => {
    setPreviewFile(file);
    setPreviewUrl(url);
    setPhase('preview');
    setPrecheckPhase('idle');
    setPrecheckResult(null);
  }, []);

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
        showPreview(file, URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.94,
    );
  }, [filePrefix, ready, showPreview, template]);

  useEffect(() => {
    if (!open || phase !== 'camera' || !ready) return;

    const tick = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      const docTemplate = template === 'passport' ? 'passport' : 'licence';
      const q = assessFrameQuality(video, 'document', docTemplate);
      setQualityMsg(q.message);
      setQualityOk(q.ok);
    }, 200);

    return () => window.clearInterval(tick);
  }, [open, phase, ready, template]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.files?.[0];
    event.target.value = '';
    if (!raw) return;

    setFilePreparing(true);
    try {
      const { file, error } = await normalizeIdImageFile(raw);
      if (!file) {
        onErrorRef.current(error ?? 'Could not use that file.');
        return;
      }

      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const renamed = new File([file], `${filePrefix}-${Date.now()}.${ext}`, { type: file.type });
      showPreview(renamed, URL.createObjectURL(renamed));
    } finally {
      setFilePreparing(false);
    }
  };

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
    setPrecheckPhase('idle');
    setPrecheckResult(null);
    setPhase('camera');
  };

  const handleUsePhoto = () => {
    if (!previewFile) return;
    onCaptureRef.current(previewFile);
    onCloseRef.current();
  };

  const precheckAdvisory =
    precheckPhase === 'done' && precheckResult && !precheckResult.acceptable;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex h-[100dvh] flex-col overflow-hidden bg-[#050403]"
      role="presentation"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#3D2B0E]/80 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C4832A]">
          ID scanner
        </p>
        <button
          type="button"
          onClick={() => onCloseRef.current()}
          className="text-sm font-semibold text-[var(--cream-muted)] hover:text-[#C4832A]"
        >
          Cancel
        </button>
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="relative mx-auto min-h-0 w-full max-w-lg flex-1"
      >
        <div className="relative h-full min-h-0 bg-black">
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
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--cream-muted)]">
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

      <div className="max-h-[56dvh] shrink-0 overflow-y-auto border-t border-[#3D2B0E]/80 bg-[#0D0A06] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="mb-3 text-center text-xs leading-relaxed text-[var(--cream-muted)]">
          {phase === 'preview'
            ? precheckPhase === 'checking'
              ? 'Quick quality check running — you can confirm now if the photo looks clear.'
              : precheckResult?.acceptable
                ? 'Looks good — confirm to continue'
                : 'Confirm when the ID is readable, or rescan / upload another photo.'
            : templateLabel(template)}
        </p>

        {phase === 'preview' ? (
          <>
            {precheckPhase === 'checking' ? (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--cream-muted)]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3D2B0E] border-t-[#C4832A]" />
                Running ID acceptability checks…
              </div>
            ) : null}

            {precheckResult ? (
              <div>
                <p
                  className={`mb-3 text-center text-xs font-semibold ${
                    precheckResult.acceptable ? 'text-[#22C55E]' : 'text-[#FCA5A5]'
                  }`}
                >
                  {precheckResult.message}
                </p>
              </div>
            ) : null}

            {precheckAdvisory ? (
              <p className="mb-3 text-center text-[11px] text-[#FCA5A5]">
                Automated checks flagged this image — submit anyway only if your ID is clearly visible.
              </p>
            ) : null}

            <div className="flex items-center justify-center gap-3">
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
                disabled={!previewFile}
                className="flex-1 rounded-xl bg-[#C4832A] py-3 text-sm font-bold text-[#0D0A06] disabled:opacity-40"
              >
                Confirm and continue
              </button>
            </div>

            {precheckResult?.checks.length ? (
              <ul className="mt-4 space-y-1.5 border-t border-[#3D2B0E]/60 pt-4 text-[11px] text-[#D4C4A8]">
                {precheckResult.checks.map((check) => (
                  <li key={check.id} className="flex gap-2">
                    <span className={check.passed ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                      {check.passed ? '✓' : '✕'}
                    </span>
                    <span>
                      <span className="font-semibold text-[#F0E0C0]">{check.label}</span>
                      {check.detail ? (
                        <span className="text-[var(--cream-muted)]"> — {check.detail}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={captureFrame}
                disabled={!ready}
                className="w-full rounded-xl bg-[#C4832A] py-3 text-sm font-bold text-[#0D0A06] disabled:opacity-40"
              >
                Capture photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
                className="sr-only"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={filePreparing}
                className="w-full rounded-xl border border-[#3D2B0E] py-3 text-sm font-semibold text-[#F0E0C0]"
              >
                {filePreparing ? 'Preparing photo…' : 'Upload from device'}
              </button>
          </div>
        )}
      </div>
    </div>
  );
}
