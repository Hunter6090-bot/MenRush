import { useEffect, useRef, useState } from 'react';

interface VideoNoteCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob, durationMs: number) => void;
  onError: (message: string) => void;
  /** Max recording length in ms (default 60s). */
  maxDurationMs?: number;
}

function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

/**
 * Compact in-chat video note recorder — live camera via getUserMedia,
 * same family as voice notes (record → send), not a file picker.
 */
export function VideoNoteCaptureModal({
  open,
  onClose,
  onCapture,
  onError,
  maxDurationMs = 60_000,
}: VideoNoteCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onCaptureRef = useRef(onCapture);

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    onCaptureRef.current = onCapture;
  }, [onClose, onCapture, onError]);

  const clearTimers = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const resetCapture = () => {
    clearTimers();
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setSeconds(0);
    setPendingBlob(null);
    setPendingDuration(0);
    setPendingUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useEffect(() => {
    if (!open) {
      resetCapture();
      setReady(false);
      stopStream();
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current('Video notes need HTTPS and camera access.');
      onCloseRef.current();
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      })
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
            if (cancelled) return;
            if (video.videoWidth > 0 && video.videoHeight > 0) setReady(true);
            else setReady(true);
          };
          video.onloadedmetadata = markReady;
          void video.play().then(markReady).catch(() => {
            if (cancelled) return;
            onErrorRef.current('Could not start the camera preview.');
            onCloseRef.current();
          });
        } else {
          setReady(true);
        }
      })
      .catch((error: DOMException) => {
        if (cancelled) return;
        onErrorRef.current(
          error?.name === 'NotAllowedError'
            ? 'Camera access was blocked.'
            : 'Could not open the camera.',
        );
        onCloseRef.current();
      });

    return () => {
      cancelled = true;
      clearTimers();
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      recorderRef.current = null;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  }, [pendingUrl]);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || recording || pendingBlob) return;

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
    let mr: MediaRecorder;
    try {
      mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      onErrorRef.current('Video recording is not supported on this device.');
      return;
    }

    recorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    mr.onstop = () => {
      clearTimers();
      const duration = Date.now() - startRef.current;
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'video/webm' });
      setRecording(false);
      setSeconds(0);
      recorderRef.current = null;
      if (duration < 600 || blob.size < 2000) {
        onErrorRef.current('Video was too short — hold a moment longer.');
        return;
      }
      setPendingBlob(blob);
      setPendingDuration(duration);
      setPendingUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    };

    startRef.current = Date.now();
    mr.start(250);
    setRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(
      () => setSeconds((s) => Math.min(Math.floor(maxDurationMs / 1000), s + 1)),
      1000,
    );
    maxTimerRef.current = window.setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
    }, maxDurationMs);
  };

  const stopRecording = () => {
    const mr = recorderRef.current;
    if (mr && mr.state === 'recording') mr.stop();
  };

  const handleSend = () => {
    if (!pendingBlob) return;
    onCaptureRef.current(pendingBlob, pendingDuration);
    onCloseRef.current();
  };

  const handleRetake = () => {
    setPendingBlob(null);
    setPendingDuration(0);
    setPendingUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    // Re-attach live stream to the preview element.
    const video = videoRef.current;
    if (video && streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => undefined);
    }
  };

  const handleClose = () => {
    resetCapture();
    onCloseRef.current();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/88 backdrop-blur-md"
      onClick={handleClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Record a video note"
        data-testid="video-note-capture"
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#3D2B0E] bg-[#0D0A06]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[3/4] bg-black">
          {pendingUrl ? (
            <video
              src={pendingUrl}
              controls
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {recording ? (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: '#E5484D', boxShadow: '0 0 8px #E5484D' }}
              />
              <span className="text-xs font-semibold text-[var(--cream)]" data-testid="video-note-timer">
                {formatSeconds(seconds)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-[#3D2B0E] px-4 py-2 text-sm text-[var(--cream-muted)]"
          >
            Cancel
          </button>

          {pendingBlob ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                data-testid="video-note-retake"
                className="rounded-xl border border-[#3D2B0E] px-4 py-2 text-sm font-semibold text-[var(--cream)]"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={handleSend}
                data-testid="video-note-send"
                className="rounded-xl bg-[#C4832A] px-5 py-2 text-sm font-bold text-[#0D0A06]"
              >
                Send
              </button>
            </>
          ) : recording ? (
            <button
              type="button"
              onClick={stopRecording}
              data-testid="video-note-stop"
              className="rounded-xl bg-[#E5484D] px-5 py-2 text-sm font-bold text-white"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={!ready}
              data-testid="video-note-record"
              className="rounded-xl bg-[#C4832A] px-5 py-2 text-sm font-bold text-[#0D0A06] disabled:opacity-40"
            >
              Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
