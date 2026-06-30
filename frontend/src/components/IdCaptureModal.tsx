import { useCallback, useEffect, useRef, useState } from 'react';
import { assessFrameQuality } from '../lib/captureQuality';
import { DocumentScannerOverlay } from './DocumentScannerOverlay';

export type IdDocumentTemplate = 'passport' | 'driving_license_front' | 'driving_license_back';

const STEADY_MS = 1400;

interface IdCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onError: (message: string) => void;
  template: IdDocumentTemplate;
  ariaLabel?: string;
  filePrefix?: string;
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

const PREVIEW_CHECKS = [
  'All four corners of the document are visible',
  'Text is sharp and readable — no blur',
  'No glare covering your name or photo',
  'This is a real government ID — not a screen photo',
];

export function IdCaptureModal({
  open,
  onClose,
  onCapture,
  onError,
  template,
  ariaLabel = 'Scan your ID',
  filePrefix = 'id',
}: IdCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const steadySinceRef = useRef<number | null>(null);
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
  const [steadyProgress, setSteadyProgress] = useState(0);

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
      setSteadyProgress(0);
      steadySinceRef.current = null;
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

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onErrorRef.current('Could not capture the scan.');
      return;
    }
    ctx.drawImage(video, 0, 0);
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
        steadySinceRef.current = null;
        setSteadyProgress(0);
      },
      'image/jpeg',
      0.94,
    );
  }, [filePrefix, ready]);

  useEffect(() => {
    captureFrameRef.current = captureFrame;
  }, [captureFrame]);

  useEffect(() => {
    if (!open || phase !== 'camera' || !ready) return;

    const tick = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      const q = assessFrameQuality(video, 'document');
      setQualityMsg(q.message);
      setQualityOk(q.ok);

      if (!q.ok) {
        steadySinceRef.current = null;
        setSteadyProgress(0);
        return;
      }

      const now = Date.now();
      if (steadySinceRef.current === null) {
        steadySinceRef.current = now;
      }
      const elapsed = now - steadySinceRef.current;
      setSteadyProgress(Math.min(1, elapsed / STEADY_MS));

      if (elapsed >= STEADY_MS) {
        captureFrameRef.current();
      }
    }, 120);

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
    steadySinceRef.current = null;
    setSteadyProgress(0);
    setPhase('camera');
  };

  const handleUsePhoto = () => {
    if (!previewFile) return;
    onCaptureRef.current(previewFile);
    onCloseRef.current();
  };

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
              <DocumentScannerOverlay mode="document" template={template} scanning={qualityOk} />
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
                        ? 'bg-[#C4832A]/20 text-[#C4832A] border border-[#C4832A]/40'
                        : 'bg-[#0D0A06]/85 text-[#F0E0C0] border border-[#3D2B0E]'
                    }`}
                  >
                    {qualityMsg}
                  </span>
                  {qualityOk ? (
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-[#3D2B0E]">
                      <div
                        className="h-full bg-[#C4832A] transition-all duration-100"
                        style={{ width: `${steadyProgress * 100}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            previewUrl && (
              <img src={previewUrl} alt="ID scan preview" className="absolute inset-0 h-full w-full object-contain bg-black" />
            )
          )}
        </div>
      </div>

      <div className="border-t border-[#3D2B0E]/80 bg-[#0D0A06] px-4 py-4">
        <p className="mb-3 text-center text-xs leading-relaxed text-[#A89070]">
          {phase === 'preview' ? 'Confirm this scan is acceptable' : templateLabel(template)}
        </p>

        {phase === 'preview' ? (
          <ul className="mb-4 space-y-1.5 text-[11px] text-[#D4C4A8]">
            {PREVIEW_CHECKS.map((item) => (
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
                Rescan
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                className="flex-1 rounded-xl bg-[#C4832A] py-3 text-sm font-bold text-[#0D0A06]"
              >
                Confirm scan
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