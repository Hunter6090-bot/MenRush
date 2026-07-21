import { useCallback, useEffect, useRef, useState } from 'react';
import { assessFrameQuality, captureSelfieRegion } from '../lib/captureQuality';
import { DocumentScannerOverlay } from './DocumentScannerOverlay';

interface SelfieCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onError: (message: string) => void;
  /** Full ID-style flow for verification; compact for in-chat selfies. */
  variant?: 'verification' | 'compact';
  facingMode?: 'user' | 'environment';
  mirror?: boolean;
  ariaLabel?: string;
  filePrefix?: string;
  captureLabel?: string;
  aspectClassName?: string;
  instruction?: string;
}

const SELFIE_CHECKS = [
  'Your full face is visible and centred',
  'No sunglasses, mask, or hat',
  'Plain background if possible',
  'This is a live photo — not an old picture',
];

function CompactSelfieCapture({
  open,
  onClose,
  onCapture,
  onError,
  facingMode,
  mirror,
  ariaLabel,
  filePrefix,
  captureLabel,
  aspectClassName,
}: SelfieCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onCaptureRef = useRef(onCapture);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    onCaptureRef.current = onCapture;
  }, [onClose, onCapture, onError]);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current('Photos need HTTPS and camera access.');
      onCloseRef.current();
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facingMode ?? 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          const markReady = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) setReady(true);
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
          error?.name === 'NotAllowedError' ? 'Camera access was blocked.' : 'Could not open the camera.',
        );
        onCloseRef.current();
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, facingMode]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !ready || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCaptureRef.current(new File([blob], `${filePrefix ?? 'selfie'}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      onCloseRef.current();
    }, 'image/jpeg', 0.92);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/88 backdrop-blur-md" onClick={() => onCloseRef.current()} role="presentation">
      <div role="dialog" aria-modal aria-label={ariaLabel ?? 'Take a selfie'} className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#3D2B0E] bg-[#0D0A06]" onClick={(e) => e.stopPropagation()}>
        <div className={`relative ${aspectClassName ?? 'aspect-[3/4]'} bg-black`}>
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" style={mirror ? { transform: 'scaleX(-1)' } : undefined} />
        </div>
        <div className="flex justify-center gap-4 px-4 py-4">
          <button type="button" onClick={() => onCloseRef.current()} className="rounded-xl border border-[#3D2B0E] px-4 py-2 text-sm text-[var(--cream-muted)]">Cancel</button>
          <button type="button" onClick={handleCapture} disabled={!ready} className="rounded-xl bg-[#C4832A] px-5 py-2 text-sm font-bold text-[#0D0A06] disabled:opacity-40">{captureLabel ?? 'Capture'}</button>
        </div>
      </div>
    </div>
  );
}

function VerificationSelfieCapture({
  open,
  onClose,
  onCapture,
  onError,
  facingMode = 'user',
  mirror = facingMode === 'user',
  ariaLabel = 'Live selfie verification',
  filePrefix = 'selfie',
  instruction,
}: SelfieCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onCaptureRef = useRef(onCapture);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'camera' | 'preview'>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [qualityMsg, setQualityMsg] = useState('Starting camera…');
  const [qualityOk, setQualityOk] = useState(false);

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
    }
  }, [open]);

  useEffect(() => {
    if (!open || phase !== 'camera') {
      setReady(false);
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current('Live selfie needs HTTPS and camera access.');
      onCloseRef.current();
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
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
            if (video.videoWidth > 0 && video.videoHeight > 0) setReady(true);
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
            ? 'Camera access was blocked.'
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
  }, [open, phase, facingMode]);

  const captureForPreview = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready || video.videoWidth === 0) return;

    const canvas = captureSelfieRegion(video, mirror);
    if (!canvas) {
      onErrorRef.current('Could not capture the photo.');
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onErrorRef.current('Could not capture the photo.');
          return;
        }
        const file = new File([blob], `${filePrefix}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPreviewFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase('preview');
      },
      'image/jpeg',
      0.94,
    );
  }, [filePrefix, mirror, ready]);

  useEffect(() => {
    if (!open || phase !== 'camera' || !ready) return;

    const tick = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      const q = assessFrameQuality(video, 'selfie');
      setQualityMsg(q.message);
      setQualityOk(q.ok);
    }, 200);

    return () => window.clearInterval(tick);
  }, [open, phase, ready]);

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
    setPhase('camera');
  };

  const handleConfirm = () => {
    if (!previewFile) return;
    onCaptureRef.current(previewFile);
    onCloseRef.current();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#050403]" role="presentation">
      <div className="flex items-center justify-between border-b border-[#3D2B0E]/80 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C4832A]">
          Live selfie check
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
                style={mirror ? { transform: 'scaleX(-1)' } : undefined}
              />
              <DocumentScannerOverlay mode="selfie" aligned={qualityOk} />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--cream-muted)]">
                  Initialising camera…
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
              <img src={previewUrl} alt="Selfie preview" className="absolute inset-0 h-full w-full object-contain bg-black" />
            )
          )}
        </div>
      </div>

      <div className="border-t border-[#3D2B0E]/80 bg-[#0D0A06] px-4 py-4">
        <p className="mb-3 text-center text-xs leading-relaxed text-[var(--cream-muted)]">
          {phase === 'preview'
            ? instruction ? `Captured: ${instruction}` : 'We will compare this live photo to your ID'
            : instruction || 'Centre your face in the oval. Look straight at the camera.'}
        </p>

        {phase === 'preview' ? (
          <ul className="mb-4 space-y-1.5 text-[11px] text-[#D4C4A8]">
            {SELFIE_CHECKS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[#C4832A]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center justify-center gap-3">
          {phase === 'preview' ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 rounded-xl border border-[#3D2B0E] py-3 text-sm font-semibold text-[#F0E0C0]"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-xl bg-[#C4832A] py-3 text-sm font-bold text-[#0D0A06]"
              >
                Confirm selfie
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={captureForPreview}
              disabled={!ready}
              className="w-full rounded-xl bg-[#C4832A] py-3 text-sm font-bold text-[#0D0A06] disabled:opacity-40"
            >
              Capture selfie
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SelfieCaptureModal({ variant = 'verification', ...props }: SelfieCaptureModalProps) {
  if (variant === 'compact') {
    return <CompactSelfieCapture {...props} variant="compact" />;
  }
  return <VerificationSelfieCapture {...props} variant="verification" />;
}
