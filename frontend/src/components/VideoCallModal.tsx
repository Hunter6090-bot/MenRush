import { useCallback, useEffect, useRef, useState } from 'react';
import { useCallStore } from '../hooks/store';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';
import { createCallTone, type CallToneKind } from '../lib/callTones';
import { registerOutgoingCallHandler } from '../lib/callBridge';
import { attachStreamToVideo, detachStreamFromVideo, mapCallMediaError } from '../lib/callMedia';

type PrimaryFeed = 'remote' | 'local';

const PIP_SIZE_PRESETS = {
  s: { width: 96, height: 144 },
  m: { width: 128, height: 192 },
  l: { width: 168, height: 252 },
  xl: { width: 216, height: 324 },
} as const;

type PipSizeKey = keyof typeof PIP_SIZE_PRESETS;

const MIN_PIP = { width: 80, height: 120 };
const MAX_PIP = { width: 280, height: 420 };

// Unanswered calls end cleanly after this long. Overridable in tests so the
// timeout path can be exercised without waiting the full 30s.
const CALL_TIMEOUT_MS =
  (typeof window !== 'undefined' &&
    (window as unknown as { __MENRUSH_CALL_TIMEOUT_MS__?: number }).__MENRUSH_CALL_TIMEOUT_MS__) ||
  30_000;

export function VideoCallModal() {
  const socket = useSocket();
  const {
    callStatus,
    peerId,
    peerName,
    incomingOffer,
    callSetupError,
    setIncoming,
    resetCall,
    setCallSetupError,
  } = useCallStore();

  const {
    localStream,
    remoteStream,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    isMuted,
    isCameraOff,
    facingMode,
    canSwitchCamera,
    isSwitchingCamera,
  } = useWebRTC();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  const [primaryFeed, setPrimaryFeed] = useState<PrimaryFeed>('remote');
  const [pipSize, setPipSize] = useState<{ width: number; height: number }>(PIP_SIZE_PRESETS.m);
  const [pipSizeKey, setPipSizeKey] = useState<PipSizeKey>('m');
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(
    null,
  );

  const resetLayout = useCallback(() => {
    setPrimaryFeed('remote');
    setPipSize(PIP_SIZE_PRESETS.m);
    setPipSizeKey('m');
  }, []);

  const detachAllVideos = useCallback(() => {
    detachStreamFromVideo(localVideoRef.current);
    detachStreamFromVideo(remoteVideoRef.current);
    detachStreamFromVideo(primaryVideoRef.current);
    detachStreamFromVideo(pipVideoRef.current);
  }, []);

  useEffect(() => {
    if (callStatus === 'calling') {
      void attachStreamToVideo(localVideoRef.current, localStream);
      detachStreamFromVideo(primaryVideoRef.current);
      detachStreamFromVideo(pipVideoRef.current);
      detachStreamFromVideo(remoteVideoRef.current);
      return;
    }

    if (callStatus === 'connected') {
      const primaryStream = primaryFeed === 'remote' ? remoteStream : localStream;
      const pipStream = primaryFeed === 'remote' ? localStream : remoteStream;
      void attachStreamToVideo(primaryVideoRef.current, primaryStream);
      void attachStreamToVideo(pipVideoRef.current, pipStream);
      detachStreamFromVideo(localVideoRef.current);
      detachStreamFromVideo(remoteVideoRef.current);
      return;
    }

    detachAllVideos();
  }, [localStream, remoteStream, callStatus, primaryFeed, detachAllVideos]);

  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      resetLayout();
      detachAllVideos();
    }
  }, [callStatus, resetLayout, detachAllVideos]);

  useEffect(() => {
    registerOutgoingCallHandler(async (targetPeerId, _targetName) => {
      await startCall(targetPeerId, _targetName);
    });
    return () => registerOutgoingCallHandler(null);
  }, [startCall]);

  // ── Ring tones ───────────────────────────────────────────────────────────
  // Caller hears the outgoing ringback while 'calling'; recipient hears the
  // incoming ringtone while 'ringing'. Leaving either state (answer, reject,
  // cancel, error, disconnect, timeout) or unmounting stops the tone.
  const desiredTone: CallToneKind | null =
    callStatus === 'calling' ? 'outgoing' : callStatus === 'ringing' ? 'incoming' : null;

  useEffect(() => {
    if (!desiredTone) return;
    const player = createCallTone(desiredTone);
    void player.start();
    return () => player.stop();
  }, [desiredTone]);

  // ── Unanswered-call timeout ────────────────────────────────────────────────
  // Applies to both the waiting caller ('calling') and a never-answered
  // recipient ('ringing'). endCall() signals the peer and tears down locally,
  // so the call ends cleanly on both devices.
  useEffect(() => {
    if (callStatus !== 'calling' && callStatus !== 'ringing') return;
    const timer = setTimeout(() => {
      endCall();
    }, CALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [callStatus, endCall]);

  // Listen for incoming call offers
  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({
      from,
      fromName,
      offer,
    }: {
      from: string;
      fromName: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      setCallSetupError(null);
      setIncoming(from, fromName, offer);
    };

    socket.on('call:incoming', onIncoming);
    return () => {
      socket.off('call:incoming', onIncoming);
    };
  }, [socket, setIncoming, setCallSetupError]);

  const handleAccept = async () => {
    if (!incomingOffer || !peerId) return;
    try {
      const answer = await answerCall(incomingOffer, peerId);
      socket?.emit('call:answer', { to: peerId, answer });
      useCallStore.getState().setConnected();
    } catch (error: unknown) {
      endCall();
      setCallSetupError(mapCallMediaError(error));
    }
  };

  const handleReject = () => {
    if (peerId && socket) {
      socket.emit('call:reject', { to: peerId });
    }
    endCall();
  };

  if (callSetupError) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      >
        <div
          className="w-full max-w-sm rounded-3xl p-8 text-center"
          style={{ background: '#1E1508', border: '1px solid #3D2B0E' }}
        >
          <h2 className="text-xl font-bold" style={{ color: '#F0E0C0' }}>{callSetupError}</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: '#A89070' }}>
            Open MenRush from its secure HTTPS address, then allow camera and microphone access.
          </p>
          <button
            type="button"
            onClick={() => setCallSetupError(null)}
            className="mt-6 w-full h-12 rounded-2xl text-sm font-semibold"
            style={{ background: '#C4832A', color: '#0D0A06' }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (callStatus === 'idle' || callStatus === 'ended') return null;

  const mirrorLocalVideo = facingMode === 'user';
  const localVideoMirrorStyle = mirrorLocalVideo ? { transform: 'scaleX(-1)' } : undefined;

  const swapFeeds = () => {
    setPrimaryFeed((feed) => (feed === 'remote' ? 'local' : 'remote'));
  };

  const applyPipPreset = (key: PipSizeKey) => {
    setPipSizeKey(key);
    setPipSize(PIP_SIZE_PRESETS[key]);
  };

  const onPipResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startW: pipSize.width,
      startH: pipSize.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPipResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = resizeRef.current;
    if (!start) return;
    const nextW = Math.min(MAX_PIP.width, Math.max(MIN_PIP.width, start.startW + (event.clientX - start.startX)));
    const nextH = Math.min(MAX_PIP.height, Math.max(MIN_PIP.height, start.startH + (event.clientY - start.startY)));
    setPipSize({ width: nextW, height: nextH });
    setPipSizeKey('m');
  };

  const onPipResizeEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  // ── Ringing / incoming ───────────────────────────────────────────────────
  if (callStatus === 'ringing') {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      >
        <span data-testid="call-tone" data-tone="incoming" className="sr-only" aria-hidden="true" />
        <div
          className="w-full max-w-xs rounded-3xl p-8 flex flex-col items-center gap-6 animate-scale-up"
          style={{
            background: '#1E1508',
            border: '1px solid #3D2B0E',
            boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          }}
        >
          {/* Pulsing avatar */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute w-28 h-28 rounded-full opacity-30"
              style={{
                background: 'rgba(196,131,42,0.4)',
                animation: 'radarRing 2s ease-out infinite',
              }}
            />
            <div
              className="absolute w-28 h-28 rounded-full opacity-20"
              style={{
                background: 'rgba(196,131,42,0.3)',
                animation: 'radarRing 2s ease-out 0.7s infinite',
              }}
            />
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold relative z-10"
              style={{
                background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                color: '#FFF5E6',
                boxShadow: '0 4px 24px rgba(196,131,42,0.45)',
              }}
            >
              {peerName ? initials(peerName) : '?'}
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-xl font-bold" style={{ color: '#F0E0C0' }}>
              {peerName ?? 'Someone'}
            </p>
            <p className="text-sm" style={{ color: '#A89070' }}>
              Incoming call...
            </p>
          </div>

          <div className="flex gap-4 w-full">
            {/* Reject */}
            <button
              onClick={handleReject}
              className="flex-1 h-14 rounded-2xl flex items-center justify-center transition-all duration-150 active:scale-95"
              style={{
                background: 'rgba(220,38,38,0.15)',
                border: '1px solid rgba(220,38,38,0.3)',
                color: '#EF4444',
              }}
              aria-label="Reject call"
            >
              <EndCallIcon className="w-6 h-6" />
            </button>
            {/* Accept */}
            <button
              onClick={handleAccept}
              className="flex-1 h-14 rounded-2xl flex items-center justify-center transition-all duration-150 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(22,163,74,0.4)',
              }}
              aria-label="Accept call"
            >
              <PhoneIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Calling (outgoing, waiting) ──────────────────────────────────────────
  // Full-screen surface with the caller's own live camera preview, the callee
  // name/status overlaid, and cancel / mute / camera controls available while
  // it rings.
  if (callStatus === 'calling') {
    return (
      <div
        className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
        data-testid="outgoing-call"
      >
        <span data-testid="call-tone" data-tone="outgoing" className="sr-only" aria-hidden="true" />

        {/* Caller's own camera, full screen and mirrored */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ ...localVideoMirrorStyle, background: '#0D0A06' }}
        />

        {/* Fallback while the camera spins up or is turned off */}
        {(!localStream || isCameraOff) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: '#0D0A06' }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                color: '#FFF5E6',
                boxShadow: '0 4px 24px rgba(196,131,42,0.45)',
              }}
            >
              {peerName ? initials(peerName) : '?'}
            </div>
          </div>
        )}

        {/* Top scrim with callee name + ringing status */}
        <div
          className="absolute top-0 left-0 right-0 px-6 pt-10 pb-12 text-center"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent)', zIndex: 10 }}
        >
          <p className="text-2xl font-bold" style={{ color: '#F0E0C0' }}>
            {peerName ?? 'Someone'}
          </p>
          <p className="mt-1 text-sm tracking-wide" style={{ color: '#E0B878' }}>
            Ringing&hellip;
          </p>
        </div>

        {/* Controls bar */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 sm:gap-4 px-4 sm:px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4"
          style={{ zIndex: 10 }}
        >
          {/* Mute */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95"
            style={{
              background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(30,21,8,0.85)',
              border: isMuted ? '1px solid rgba(239,68,68,0.5)' : '1px solid #3D2B0E',
              backdropFilter: 'blur(8px)',
              color: isMuted ? '#EF4444' : '#F0E0C0',
            }}
          >
            {isMuted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
          </button>

          {/* Cancel */}
          <button
            onClick={endCall}
            aria-label="Cancel call"
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              boxShadow: '0 4px 20px rgba(220,38,38,0.5)',
              color: '#fff',
            }}
          >
            <EndCallIcon className="w-7 h-7" />
          </button>

          {/* Camera toggle */}
          <button
            onClick={toggleCamera}
            aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95"
            style={{
              background: isCameraOff ? 'rgba(239,68,68,0.2)' : 'rgba(30,21,8,0.85)',
              border: isCameraOff ? '1px solid rgba(239,68,68,0.5)' : '1px solid #3D2B0E',
              backdropFilter: 'blur(8px)',
              color: isCameraOff ? '#EF4444' : '#F0E0C0',
            }}
          >
            {isCameraOff ? <CameraOffIcon className="w-6 h-6" /> : <CameraIcon className="w-6 h-6" />}
          </button>

          {canSwitchCamera && (
            <button
              type="button"
              onClick={() => void switchCamera()}
              disabled={isSwitchingCamera}
              aria-label={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: 'rgba(30,21,8,0.85)',
                border: '1px solid #3D2B0E',
                backdropFilter: 'blur(8px)',
                color: '#F0E0C0',
              }}
            >
              <FlipCameraIcon className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Connected / in-call ──────────────────────────────────────────────────
  if (callStatus === 'connected') {
    const primaryIsLocal = primaryFeed === 'local';
    const primaryMirrorStyle = primaryIsLocal ? localVideoMirrorStyle : undefined;
    const pipMirrorStyle = primaryIsLocal ? undefined : localVideoMirrorStyle;
    const pipShowsLocal = primaryFeed === 'remote';
    const showPipCameraOff = pipShowsLocal && isCameraOff;
    const primaryStream = primaryFeed === 'remote' ? remoteStream : localStream;

    return (
      <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" data-testid="connected-call">
        <video
          ref={primaryVideoRef}
          autoPlay
          playsInline
          muted={primaryIsLocal}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ background: '#0D0A06', ...primaryMirrorStyle }}
        />

        {!primaryStream && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: '#0D0A06' }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                color: '#FFF5E6',
              }}
            >
              {peerName ? initials(peerName) : '?'}
            </div>
          </div>
        )}

        <div
          className="absolute bottom-28 right-4 rounded-2xl overflow-hidden shadow-2xl touch-none"
          style={{
            width: pipSize.width,
            height: pipSize.height,
            border: '2px solid rgba(196,131,42,0.5)',
            background: '#1E1508',
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={swapFeeds}
            className="absolute inset-0 z-10"
            aria-label="Swap main and picture-in-picture video"
          />
          <video
            ref={pipVideoRef}
            autoPlay
            playsInline
            muted
            className="relative z-0 h-full w-full object-cover pointer-events-none"
            style={pipMirrorStyle}
          />
          {showPipCameraOff && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
              style={{ background: '#1E1508' }}
            >
              <CameraOffIcon className="w-8 h-8" style={{ color: '#A89070' }} />
            </div>
          )}
          <button
            type="button"
            aria-label="Resize picture-in-picture video"
            onPointerDown={onPipResizeStart}
            onPointerMove={onPipResizeMove}
            onPointerUp={onPipResizeEnd}
            onPointerCancel={onPipResizeEnd}
            className="absolute bottom-1 right-1 z-30 flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              background: 'rgba(13,10,6,0.75)',
              border: '1px solid rgba(196,131,42,0.45)',
              color: '#F0E0C0',
            }}
          >
            <ResizeIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
          style={{ zIndex: 10 }}
        >
          <p className="truncate text-sm font-semibold" style={{ color: '#F0E0C0' }}>
            {peerName ?? 'Call'}
          </p>
          <div
            className="flex items-center gap-1 rounded-full px-1 py-1"
            style={{ background: 'rgba(13,10,6,0.72)', border: '1px solid #3D2B0E' }}
          >
            {(['s', 'm', 'l', 'xl'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPipPreset(key)}
                aria-label={`Picture-in-picture size ${key.toUpperCase()}`}
                className="rounded-full px-2.5 py-1 text-xs font-bold uppercase transition-colors"
                style={{
                  background: pipSizeKey === key ? '#C4832A' : 'transparent',
                  color: pipSizeKey === key ? '#0D0A06' : '#A89070',
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4"
          style={{ zIndex: 10 }}
        >
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95"
            style={{
              background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(30,21,8,0.85)',
              border: isMuted ? '1px solid rgba(239,68,68,0.5)' : '1px solid #3D2B0E',
              backdropFilter: 'blur(8px)',
              color: isMuted ? '#EF4444' : '#F0E0C0',
            }}
          >
            {isMuted ? <MicOffIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
          </button>

          <button
            type="button"
            onClick={swapFeeds}
            aria-label="Swap video views"
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95"
            style={{
              background: 'rgba(30,21,8,0.85)',
              border: '1px solid #3D2B0E',
              backdropFilter: 'blur(8px)',
              color: '#F0E0C0',
            }}
          >
            <SwapViewIcon className="w-6 h-6" />
          </button>

          <button
            onClick={endCall}
            aria-label="End call"
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              boxShadow: '0 4px 20px rgba(220,38,38,0.5)',
              color: '#fff',
            }}
          >
            <EndCallIcon className="w-7 h-7" />
          </button>

          <button
            onClick={toggleCamera}
            aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95"
            style={{
              background: isCameraOff ? 'rgba(239,68,68,0.2)' : 'rgba(30,21,8,0.85)',
              border: isCameraOff ? '1px solid rgba(239,68,68,0.5)' : '1px solid #3D2B0E',
              backdropFilter: 'blur(8px)',
              color: isCameraOff ? '#EF4444' : '#F0E0C0',
            }}
          >
            {isCameraOff ? <CameraOffIcon className="w-6 h-6" /> : <CameraIcon className="w-6 h-6" />}
          </button>

          {canSwitchCamera && (
            <button
              type="button"
              onClick={() => void switchCamera()}
              disabled={isSwitchingCamera}
              aria-label={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: 'rgba(30,21,8,0.85)',
                border: '1px solid #3D2B0E',
                backdropFilter: 'blur(8px)',
                color: '#F0E0C0',
              }}
            >
              <FlipCameraIcon className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

/** Downward handset — standard hang-up / decline affordance (FaceTime, WhatsApp, etc.). */
const EndCallIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <g transform="rotate(135 12 12)">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </g>
  </svg>
);

const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
    />
  </svg>
);

const MicOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8"
    />
  </svg>
);

const CameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8h8a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z"
    />
  </svg>
);

const CameraOffIcon = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    className={className}
    style={style}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21H4a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h3a2 2 0 012 2v9.34M15 13a3 3 0 11-5.12-2.12"
    />
  </svg>
);

const FlipCameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 8h8a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l4-2v12l-4-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l2 2-2 2M19 17l2-2-2-2" />
  </svg>
);

const SwapViewIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h12l-3-3M17 17H5l3 3" />
    <rect x="3" y="5" width="8" height="6" rx="1.5" />
    <rect x="13" y="13" width="8" height="6" rx="1.5" />
  </svg>
);

const ResizeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 14l6 6M20 14v6h-6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 10L4 4M4 10V4h6" />
  </svg>
);
