import { useEffect, useRef, useState } from 'react';

interface SelfieCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onError: (message: string) => void;
  /** Front camera for selfies; rear/environment for documents. */
  facingMode?: 'user' | 'environment';
  /** Mirror the preview (typical for front-camera selfies). */
  mirror?: boolean;
  ariaLabel?: string;
  filePrefix?: string;
  captureLabel?: string;
  aspectClassName?: string;
}

export function SelfieCaptureModal({
  open,
  onClose,
  onCapture,
  onError,
  facingMode = 'user',
  mirror = facingMode === 'user',
  ariaLabel = 'Take a selfie',
  filePrefix = 'selfie',
  captureLabel = 'Capture',
  aspectClassName = 'aspect-[3/4]',
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
      .getUserMedia({ video: { facingMode }, audio: false })
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
  }, [open, facingMode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !ready || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onErrorRef.current('Could not capture the photo.');
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          onErrorRef.current('Could not capture the photo.');
          return;
        }
        onCaptureRef.current(new File([blob], `${filePrefix}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        onCloseRef.current();
      },
      'image/jpeg',
      0.92,
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
      onClick={() => onCloseRef.current()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#3D2B0E] bg-[#0D0A06] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`relative ${aspectClassName} bg-black`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={mirror ? { transform: 'scaleX(-1)' } : undefined}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#A89070]">
              Starting camera…
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-4 px-4 py-4">
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="rounded-xl border border-[#3D2B0E] px-4 py-2 text-sm font-semibold text-[#A89070]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCapture}
            disabled={!ready}
            data-testid="selfie-capture"
            className="rounded-xl bg-[#C4832A] px-5 py-2 text-sm font-bold text-[#0D0A06] disabled:opacity-40"
          >
            {captureLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
