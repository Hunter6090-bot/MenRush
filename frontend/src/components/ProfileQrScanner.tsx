import { useEffect, useRef, useState } from 'react';

interface ProfileQrScannerProps {
  active: boolean;
  onScan: (value: string) => void;
  layout?: 'inline' | 'fullscreen';
}

export function ProfileQrScanner({
  active,
  onScan,
  layout = 'inline',
}: ProfileQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const isFullscreen = layout === 'fullscreen';

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(null);
      setSupported(true);
      return;
    }

    if (!window.isSecureContext) {
      setSupported(false);
      setError('Camera scanning needs HTTPS. Paste a profile link instead.');
      return;
    }

    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      setError('Camera QR scan is not supported in this browser. Paste a link instead.');
      return;
    }

    let cancelled = false;
    let raf = 0;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        await video.play();

        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              onScan(value);
              return;
            }
          } catch {
            // Ignore transient detect errors.
          }
          raf = window.requestAnimationFrame(tick);
        };

        raf = window.requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setError('Could not open the camera. Check permission or paste a link instead.');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active, onScan]);

  if (!active) return null;

  const shellClass = isFullscreen
    ? 'absolute inset-0 bg-black'
    : 'overflow-hidden rounded-2xl border border-[#3D2B0E] bg-black';

  const videoClass = isFullscreen
    ? 'absolute inset-0 h-full w-full object-cover'
    : 'aspect-[4/3] w-full object-cover';

  return (
    <div className={shellClass} data-testid="profile-qr-scanner">
      {supported && !error ? (
        <>
          <video
            ref={videoRef}
            className={videoClass}
            playsInline
            muted
            autoPlay
            aria-label="Scan profile QR code"
          />
          {isFullscreen && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-2xl border-2 border-[#C4832A]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{ width: 'min(72vw, 280px)', aspectRatio: '1 / 1' }}
              />
            </div>
          )}
        </>
      ) : (
        <div
          className={`flex items-center justify-center px-4 text-center text-xs leading-relaxed text-[#A89070] ${
            isFullscreen ? 'absolute inset-0' : 'aspect-[4/3]'
          }`}
        >
          {error}
        </div>
      )}
    </div>
  );
}
