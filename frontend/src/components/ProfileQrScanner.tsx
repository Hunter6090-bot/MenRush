import { useEffect, useRef, useState } from 'react';

interface ProfileQrScannerProps {
  active: boolean;
  onScan: (value: string) => void;
}

export function ProfileQrScanner({ active, onScan }: ProfileQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(null);
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
          video: { facingMode: { ideal: 'environment' } },
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
          setError('Could not open the camera. Check permission or paste a link below.');
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

  return (
    <div className="overflow-hidden rounded-2xl border border-[#3D2B0E] bg-black">
      {supported && !error ? (
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          playsInline
          muted
          aria-label="Scan profile QR code"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center px-4 text-center text-xs leading-relaxed text-[#A89070]">
          {error}
        </div>
      )}
    </div>
  );
}
