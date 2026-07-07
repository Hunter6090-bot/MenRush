import { useEffect, useRef } from 'react';
import { useCallStore } from '../hooks/store';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';
import { createCallTone, type CallToneKind } from '../lib/callTones';
import { registerOutgoingCallHandler } from '../lib/callBridge';
import { attachStreamToVideo, mapCallMediaError } from '../lib/callMedia';

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

  useEffect(() => {
    void attachStreamToVideo(localVideoRef.current, localStream);
  }, [localStream, callStatus]);

  useEffect(() => {
    void attachStreamToVideo(remoteVideoRef.current, remoteStream);
  }, [remoteStream, callStatus]);

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
    return (
      <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
        {/* Remote video — fills screen */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ background: '#0D0A06' }}
        />

        {/* Fallback when no remote video yet */}
        {!remoteStream && (
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

        {/* Local PiP — bottom right */}
        <div
          className="absolute bottom-28 right-4 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: 120,
            height: 180,
            border: '2px solid rgba(196,131,42,0.5)',
            background: '#1E1508',
            zIndex: 10,
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={localVideoMirrorStyle}
          />
          {isCameraOff && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: '#1E1508' }}
            >
              <CameraOffIcon className="w-8 h-8" style={{ color: '#A89070' }} />
            </div>
          )}
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

          {/* End call */}
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
            {isCameraOff ? (
              <CameraOffIcon className="w-6 h-6" />
            ) : (
              <CameraIcon className="w-6 h-6" />
            )}
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
