import { useCallback, useEffect, useRef, useState } from 'react';
import { useCallStore } from '../hooks/store';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';
import { createCallTone, type CallToneKind } from '../lib/callTones';
import { registerOutgoingCallHandler } from '../lib/callBridge';
import { getIceServers } from '../lib/webrtcCall';
import {
  attachRemoteAudio,
  attachStreamToVideo,
  detachStreamFromVideo,
  ensureInlinePlayback,
  mapCallMediaError,
  resumeRemotePlayback,
  streamHasAnyTrack,
  streamHasLiveVideo,
} from '../lib/callMedia';

const CALL_TIMEOUT_MS =
  (typeof window !== 'undefined' &&
    (window as unknown as { __MENRUSH_CALL_TIMEOUT_MS__?: number }).__MENRUSH_CALL_TIMEOUT_MS__) ||
  30_000;

const PIP_MIN = 96;
const PIP_MAX_W = 280;
const PIP_MAX_H = 400;
const PIP_DEFAULT = { w: 120, h: 180 };

type PipState = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function defaultPipPosition(w: number, h: number): PipState {
  if (typeof window === 'undefined') {
    return { x: 16, y: 16, w, h };
  }
  const pad = 16;
  const bottomChrome = 120;
  return {
    x: Math.max(pad, window.innerWidth - w - pad),
    y: Math.max(pad, window.innerHeight - h - bottomChrome),
    w,
    h,
  };
}

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
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const [remoteAudioBlocked, setRemoteAudioBlocked] = useState(false);
  const [pip, setPip] = useState<PipState>(() => defaultPipPosition(PIP_DEFAULT.w, PIP_DEFAULT.h));
  const dragRef = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origin: PipState;
  } | null>(null);

  const resetLayout = useCallback(() => {
    setRemoteAudioBlocked(false);
    setPip(defaultPipPosition(PIP_DEFAULT.w, PIP_DEFAULT.h));
  }, []);

  const detachAllVideos = useCallback(() => {
    detachStreamFromVideo(localVideoRef.current);
    detachStreamFromVideo(primaryVideoRef.current);
    detachStreamFromVideo(pipVideoRef.current);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    ensureInlinePlayback(localVideoRef.current);
    ensureInlinePlayback(primaryVideoRef.current);
    ensureInlinePlayback(pipVideoRef.current);
    ensureInlinePlayback(remoteAudioRef.current);
  }, [callStatus]);

  useEffect(() => {
    if (callStatus === 'calling') {
      void attachStreamToVideo(localVideoRef.current, localStream, { preferUnmuted: false });
      detachStreamFromVideo(primaryVideoRef.current);
      detachStreamFromVideo(pipVideoRef.current);
      void attachRemoteAudio(remoteAudioRef.current, null);
      return;
    }

    if (callStatus === 'connected') {
      // Remote <video> stays muted (iOS autoplay); A/V audio via dedicated <audio>.
      // Still re-bind whenever remoteStream identity/tracks change so frames appear
      // as soon as ontrack fires after answer.
      void attachStreamToVideo(primaryVideoRef.current, remoteStream, {
        preferUnmuted: false,
      });
      void attachRemoteAudio(remoteAudioRef.current, remoteStream).then((result) => {
        if (result === 'blocked') setRemoteAudioBlocked(true);
        else if (result === 'playing') setRemoteAudioBlocked(false);
      });
      void attachStreamToVideo(pipVideoRef.current, localStream, { preferUnmuted: false });
      detachStreamFromVideo(localVideoRef.current);
      return;
    }

    detachAllVideos();
  }, [localStream, remoteStream, callStatus, detachAllVideos]);

  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      resetLayout();
      detachAllVideos();
    }
  }, [callStatus, resetLayout, detachAllVideos]);

  useEffect(() => {
    registerOutgoingCallHandler(async (targetPeerId, targetName) => {
      await startCall(targetPeerId, targetName);
    });
    return () => registerOutgoingCallHandler(null);
  }, [startCall]);

  // Warm ICE/TURN credentials so startCall does not block on the network after getUserMedia.
  useEffect(() => {
    void getIceServers().catch(() => undefined);
  }, []);

  const desiredTone: CallToneKind | null =
    callStatus === 'calling' ? 'outgoing' : callStatus === 'ringing' ? 'incoming' : null;

  useEffect(() => {
    if (!desiredTone) return;
    const player = createCallTone(desiredTone);
    void player.start();
    return () => player.stop();
  }, [desiredTone]);

  useEffect(() => {
    if (callStatus !== 'calling' && callStatus !== 'ringing') return;
    const timer = setTimeout(() => {
      endCall();
    }, CALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [callStatus, endCall]);

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
      // ICE restart reuses call:incoming while already connected — do not reset UI to ringing.
      const status = useCallStore.getState().callStatus;
      if (status === 'connected' || status === 'calling') {
        return;
      }
      setCallSetupError(null);
      setIncoming(from, fromName, offer);
    };
    socket.on('call:incoming', onIncoming);
    return () => {
      socket.off('call:incoming', onIncoming);
    };
  }, [socket, setIncoming, setCallSetupError]);

  // Keep PiP on-screen when viewport resizes
  useEffect(() => {
    const onResize = () => {
      setPip((p) => {
        const maxX = Math.max(8, window.innerWidth - p.w - 8);
        const maxY = Math.max(8, window.innerHeight - p.h - 8);
        return {
          ...p,
          x: clamp(p.x, 8, maxX),
          y: clamp(p.y, 8, maxY),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const onPipPointerDown = (event: React.PointerEvent, mode: 'move' | 'resize') => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...pip },
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPipPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.mode === 'move') {
      const maxX = Math.max(8, window.innerWidth - drag.origin.w - 8);
      const maxY = Math.max(8, window.innerHeight - drag.origin.h - 8);
      setPip({
        ...drag.origin,
        x: clamp(drag.origin.x + dx, 8, maxX),
        y: clamp(drag.origin.y + dy, 8, maxY),
      });
      return;
    }

    // Resize from bottom-right corner, keep aspect ~2:3
    const nextW = clamp(drag.origin.w + dx, PIP_MIN, PIP_MAX_W);
    const nextH = clamp(drag.origin.h + dy, PIP_MIN, PIP_MAX_H);
    const maxX = Math.max(8, window.innerWidth - nextW - 8);
    const maxY = Math.max(8, window.innerHeight - nextH - 8);
    setPip({
      w: nextW,
      h: nextH,
      x: clamp(drag.origin.x, 8, maxX),
      y: clamp(drag.origin.y, 8, maxY),
    });
  };

  const onPipPointerUp = (event: React.PointerEvent) => {
    dragRef.current = null;
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

  const controlBtn = (
    active: boolean,
    danger: boolean,
  ): React.CSSProperties => ({
    background: danger
      ? active
        ? 'rgba(239,68,68,0.25)'
        : 'rgba(30,21,8,0.88)'
      : active
        ? 'rgba(239,68,68,0.25)'
        : 'rgba(30,21,8,0.88)',
    border: active || danger ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(12px)',
    color: active || danger ? '#F87171' : '#F5F5F5',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
  });

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
          <h2 className="text-xl font-bold" style={{ color: '#F0E0C0' }}>
            {callSetupError}
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: '#A89070' }}>
            Open MenRush from its secure HTTPS address, then allow camera and microphone access.
          </p>
          <button
            type="button"
            onClick={() => setCallSetupError(null)}
            className="mt-6 h-12 w-full rounded-2xl text-sm font-semibold"
            style={{ background: '#C4832A', color: '#0D0A06' }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (callStatus === 'idle' || callStatus === 'ended') return null;

  // ── Incoming ─────────────────────────────────────────────────────────────
  if (callStatus === 'ringing') {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      >
        <span data-testid="call-tone" data-tone="incoming" className="sr-only" aria-hidden="true" />
        <div
          className="flex w-full max-w-xs animate-scale-up flex-col items-center gap-6 rounded-3xl p-8"
          style={{
            background: '#1E1508',
            border: '1px solid #3D2B0E',
            boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          }}
        >
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-28 w-28 rounded-full opacity-30"
              style={{
                background: 'rgba(196,131,42,0.4)',
                animation: 'radarRing 2s ease-out infinite',
              }}
            />
            <div
              className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                color: '#FFF5E6',
              }}
            >
              {peerName ? initials(peerName) : '?'}
            </div>
          </div>
          <div className="space-y-1 text-center">
            <p className="text-xl font-bold" style={{ color: '#F0E0C0' }}>
              {peerName ?? 'Someone'}
            </p>
            <p className="text-sm" style={{ color: '#A89070' }}>
              Incoming call…
            </p>
          </div>
          <div className="flex w-full gap-4">
            <button
              type="button"
              onClick={handleReject}
              className="flex h-14 flex-1 items-center justify-center rounded-2xl transition-transform active:scale-95"
              style={{
                background: 'rgba(220,38,38,0.15)',
                border: '1px solid rgba(220,38,38,0.3)',
                color: '#EF4444',
              }}
              aria-label="Reject call"
            >
              <EndCallIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => void handleAccept()}
              className="flex h-14 flex-1 items-center justify-center rounded-2xl transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff',
              }}
              aria-label="Accept call"
            >
              <PhoneIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Outgoing ─────────────────────────────────────────────────────────────
  if (callStatus === 'calling') {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black"
        data-testid="outgoing-call"
      >
        <span data-testid="call-tone" data-tone="outgoing" className="sr-only" aria-hidden="true" />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ background: '#0D0A06' }}
        />
        {(!localStream || isCameraOff) && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0D0A06' }}>
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold"
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
          className="absolute left-0 right-0 top-0 px-6 pb-12 pt-10 text-center"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent)', zIndex: 10 }}
        >
          <p className="text-2xl font-bold" style={{ color: '#F0E0C0' }}>
            {peerName ?? 'Someone'}
          </p>
          <p className="mt-1 text-sm tracking-wide" style={{ color: '#E0B878' }}>
            Ringing…
          </p>
        </div>
        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          canSwitchCamera={canSwitchCamera}
          isSwitchingCamera={isSwitchingCamera}
          facingMode={facingMode}
          onMute={toggleMute}
          onEnd={endCall}
          onToggleCamera={toggleCamera}
          onSwitchCamera={() => void switchCamera()}
          endLabel="Cancel call"
          controlBtn={controlBtn}
        />
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  if (callStatus === 'connected') {
    const remoteReady = streamHasAnyTrack(remoteStream);
    const remoteHasVideo = streamHasLiveVideo(remoteStream);
    const localHasVideo = streamHasLiveVideo(localStream) && !isCameraOff;

    return (
      <div
        ref={shellRef}
        className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black"
        data-testid="connected-call"
      >
        {/* Main: remote only — no feed swap / no mirror mode */}
        <video
          ref={primaryVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ background: '#0D0A06' }}
        />

        {(!remoteReady || !remoteHasVideo) && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6"
            style={{ background: 'rgba(13,10,6,0.92)' }}
            data-testid="remote-waiting"
          >
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                color: '#FFF5E6',
              }}
            >
              {peerName ? initials(peerName) : '?'}
            </div>
            <p className="text-center text-sm font-semibold" style={{ color: '#F0E0C0' }}>
              {!remoteReady
                ? `Connecting to ${peerName ?? 'him'}…`
                : 'Waiting for his camera…'}
            </p>
          </div>
        )}

        {remoteAudioBlocked && remoteReady ? (
          <button
            type="button"
            data-testid="enable-call-audio"
            onClick={() => {
              void resumeRemotePlayback(primaryVideoRef.current, remoteAudioRef.current).then((ok) => {
                if (ok) setRemoteAudioBlocked(false);
              });
            }}
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full px-5 py-3 text-sm font-extrabold uppercase tracking-wide"
            style={{ background: '#C4832A', color: '#0D0A06', boxShadow: '0 8px 28px rgba(0,0,0,0.5)' }}
          >
            Tap for sound
          </button>
        ) : null}

        {/* iOS Safari: remote audio is more reliable on a dedicated element */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

        {/* Draggable + resizable local PiP */}
        <div
          role="group"
          aria-label="Your video preview"
          data-testid="local-pip"
          className="absolute touch-none select-none overflow-hidden rounded-2xl shadow-2xl"
          style={{
            left: pip.x,
            top: pip.y,
            width: pip.w,
            height: pip.h,
            border: '2px solid rgba(196,131,42,0.55)',
            background: '#1E1508',
            zIndex: 30,
            transition: dragRef.current ? undefined : 'box-shadow 0.15s ease',
          }}
        >
          <div
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => onPipPointerDown(e, 'move')}
            onPointerMove={onPipPointerMove}
            onPointerUp={onPipPointerUp}
            onPointerCancel={onPipPointerUp}
          />
          <video
            ref={pipVideoRef}
            autoPlay
            playsInline
            muted
            className="pointer-events-none relative z-0 h-full w-full object-cover"
          />
          {(!localHasVideo || isCameraOff) && (
            <div
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: '#1E1508' }}
            >
              <CameraOffIcon className="h-8 w-8" style={{ color: '#A89070' }} />
            </div>
          )}
          <p
            className="pointer-events-none absolute bottom-1.5 left-1.5 z-20 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(13,10,6,0.78)', color: '#E0A14A' }}
          >
            You
          </p>
          {/* Resize handle — bottom-right corner */}
          <button
            type="button"
            aria-label="Resize your video"
            data-testid="pip-resize"
            className="absolute bottom-0 right-0 z-30 flex h-8 w-8 cursor-nwse-resize items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, transparent 40%, rgba(196,131,42,0.55) 40%)',
              color: '#F0E0C0',
            }}
            onPointerDown={(e) => onPipPointerDown(e, 'resize')}
            onPointerMove={onPipPointerMove}
            onPointerUp={onPipPointerUp}
            onPointerCancel={onPipPointerUp}
          >
            <ResizeCornerIcon className="h-3.5 w-3.5 opacity-90" />
          </button>
        </div>

        <div
          className="pointer-events-none absolute left-0 right-0 top-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
          style={{
            zIndex: 20,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent)',
            paddingBottom: 28,
          }}
        >
          <p className="truncate text-center text-sm font-semibold tracking-wide" style={{ color: '#F0E0C0' }}>
            {peerName ?? 'Call'}
            {remoteReady ? '' : ' · connecting…'}
          </p>
        </div>

        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          canSwitchCamera={canSwitchCamera}
          isSwitchingCamera={isSwitchingCamera}
          facingMode={facingMode}
          onMute={toggleMute}
          onEnd={endCall}
          onToggleCamera={toggleCamera}
          onSwitchCamera={() => void switchCamera()}
          endLabel="End call"
          controlBtn={controlBtn}
        />
      </div>
    );
  }

  return null;
}

// ── Control bar ────────────────────────────────────────────────────────────

function CallControls({
  isMuted,
  isCameraOff,
  canSwitchCamera,
  isSwitchingCamera,
  facingMode,
  onMute,
  onEnd,
  onToggleCamera,
  onSwitchCamera,
  endLabel,
  controlBtn,
}: {
  isMuted: boolean;
  isCameraOff: boolean;
  canSwitchCamera: boolean;
  isSwitchingCamera: boolean;
  facingMode: string;
  onMute: () => void;
  onEnd: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  endLabel: string;
  controlBtn: (active: boolean, danger: boolean) => React.CSSProperties;
}) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 sm:gap-4 px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-6"
      style={{
        zIndex: 40,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.72) 0%, transparent 100%)',
      }}
    >
      {/* Mic */}
      <button
        type="button"
        onClick={onMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        data-testid="call-mute"
        className="flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95"
        style={controlBtn(isMuted, false)}
      >
        {isMuted ? <MicOffIcon className="h-6 w-6" /> : <MicIcon className="h-6 w-6" />}
      </button>

      {/* Single video on/off */}
      <button
        type="button"
        onClick={onToggleCamera}
        aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        data-testid="call-camera-toggle"
        className="flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95"
        style={controlBtn(isCameraOff, false)}
      >
        {isCameraOff ? <CameraOffIcon className="h-6 w-6" /> : <CameraIcon className="h-6 w-6" />}
      </button>

      {/* End */}
      <button
        type="button"
        onClick={onEnd}
        aria-label={endLabel}
        data-testid="call-end"
        className="flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
          boxShadow: '0 4px 20px rgba(220,38,38,0.5)',
          color: '#fff',
        }}
      >
        <EndCallIcon className="h-7 w-7" />
      </button>

      {/* Front / rear camera switch only — no mirror toggle */}
      <button
        type="button"
        onClick={onSwitchCamera}
        disabled={!canSwitchCamera || isSwitchingCamera}
        aria-label={
          facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'
        }
        data-testid="call-switch-camera"
        title={
          canSwitchCamera
            ? facingMode === 'user'
              ? 'Rear camera'
              : 'Front camera'
            : 'Camera switch unavailable on this device'
        }
        className="flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
        style={controlBtn(false, false)}
      >
        <SwitchCameraIcon
          className={`h-6 w-6 ${isSwitchingCamera ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

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

/** Standard camera-switch: two circular arrows (front ↔ rear). */
const SwitchCameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20 8a8 8 0 00-13.66-4M4 4v4h4"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16a8 8 0 0013.66 4M20 20v-4h-4"
    />
  </svg>
);

const ResizeCornerIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 20h6v-6M10 4H4v6" />
  </svg>
);
