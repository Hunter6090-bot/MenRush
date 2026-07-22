import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useSocket } from './useSocket';
import { useCallStore } from './store';
import {
  acquireLocalMedia,
  attachLocalTracks,
  canFlipCamera,
  createPeerConnection,
  flipLocalCamera,
  getIceServers,
  waitForSocket,
  type CameraFacing,
} from '../lib/webrtcCall';

function iceCandidatePayload(candidate: RTCIceCandidate): RTCIceCandidateInit {
  if (typeof candidate.toJSON === 'function') {
    return candidate.toJSON();
  }
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  };
}

function sessionDescriptionPayload(
  desc: RTCSessionDescription | RTCSessionDescriptionInit,
): RTCSessionDescriptionInit {
  if (typeof (desc as RTCSessionDescription).toJSON === 'function') {
    return (desc as RTCSessionDescription).toJSON();
  }
  return { type: desc.type, sdp: desc.sdp };
}

function isUsableIceCandidate(candidate: RTCIceCandidateInit | null | undefined): boolean {
  if (!candidate) return false;
  // Safari sometimes emits empty-string candidates that throw on addIceCandidate.
  if (typeof candidate.candidate === 'string' && candidate.candidate.trim() === '') {
    return false;
  }
  return true;
}

export function useWebRTC() {
  const socket = useSocket();
  const { callStatus, peerId, setConnected, resetCall, setCallSetupError } = useCallStore();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  /** ICE while remote description not set yet (same PC). */
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  /** ICE that arrived before answer/start created a PC (common on callee). */
  const earlyIceByPeerRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remotePeerRef = useRef<string | null>(null);
  /** Only the caller creates offers — prevents glare if both somehow initiate. */
  const isCallerRef = useRef(false);
  const iceRestartAttemptedRef = useRef(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacing>('user');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection, peerKey?: string) => {
    if (!pc.remoteDescription) return;

    if (peerKey) {
      const early = earlyIceByPeerRef.current.get(peerKey) ?? [];
      earlyIceByPeerRef.current.delete(peerKey);
      pendingIceRef.current.push(...early);
    }

    const pending = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of pending) {
      if (!isUsableIceCandidate(candidate)) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore stale candidates */
      }
    }
  }, []);

  const releaseMedia = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
      } catch {
        /* ignore */
      }
      pc.getSenders().forEach((sender) => {
        try {
          sender.track?.stop();
        } catch {
          /* ignore */
        }
      });
      pc.close();
    }
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    remotePeerRef.current = null;
    pendingIceRef.current = [];
    isCallerRef.current = false;
    iceRestartAttemptedRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setFacingMode('user');
    setCanSwitchCamera(false);
    setIsSwitchingCamera(false);
  }, []);

  const publishRemoteStream = useCallback((stream: MediaStream) => {
    remoteStreamRef.current = stream;
    // New MediaStream wrapper so React always sees a reference change when tracks update.
    setRemoteStream(new MediaStream(stream.getTracks()));
  }, []);

  const tryIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    const activeSocket = socket;
    const remotePeerId = remotePeerRef.current;
    if (!pc || !activeSocket || !remotePeerId || !isCallerRef.current) return;
    if (iceRestartAttemptedRef.current) return;
    if (pc.signalingState !== 'stable') return;

    iceRestartAttemptedRef.current = true;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      activeSocket.emit('call:initiate', {
        to: remotePeerId,
        offer: sessionDescriptionPayload(pc.localDescription ?? offer),
      });
    } catch (err) {
      console.error('[webrtc] ICE restart failed', err);
    }
  }, [socket]);

  const bindPeerConnection = useCallback(
    (remotePeerId: string, activeSocket: Socket, iceServers: RTCIceServer[]) => {
      remotePeerRef.current = remotePeerId;
      pendingIceRef.current = [];
      iceRestartAttemptedRef.current = false;

      const pc = createPeerConnection(iceServers);
      remoteStreamRef.current = null;
      setRemoteStream(null);

      pc.ontrack = (ev) => {
        const track = ev.track;
        if (!track) return;

        let inbound = ev.streams[0] ?? remoteStreamRef.current ?? new MediaStream();
        if (!inbound.getTracks().some((t) => t.id === track.id)) {
          try {
            inbound.addTrack(track);
          } catch {
            inbound = new MediaStream([...inbound.getTracks(), track]);
          }
        }

        publishRemoteStream(inbound);

        track.addEventListener('unmute', () => {
          const current = remoteStreamRef.current;
          if (current) publishRemoteStream(current);
        });
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !isUsableIceCandidate(iceCandidatePayload(ev.candidate))) return;
        activeSocket.emit('call:ice-candidate', {
          to: remotePeerId,
          candidate: iceCandidatePayload(ev.candidate),
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnected();
        }
        if (pc.connectionState === 'failed') {
          void (async () => {
            await tryIceRestart();
            // Allow ICE restart a short window before giving up.
            await new Promise((r) => window.setTimeout(r, 4000));
            if (pcRef.current === pc && pc.connectionState === 'failed') {
              setCallSetupError(
                'Could not connect the call across networks. Check Wi‑Fi or mobile data and try again.',
              );
              releaseMedia();
              resetCall();
            }
          })();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          void tryIceRestart();
        }
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          iceRestartAttemptedRef.current = false;
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [publishRemoteStream, releaseMedia, resetCall, setCallSetupError, setConnected, tryIceRestart],
  );

  const startCall = useCallback(
    async (targetPeerId: string, _peerName: string) => {
      if (!socket) throw new Error('signalling_unavailable');
      await waitForSocket(socket);

      isCallerRef.current = true;
      const iceServers = await getIceServers();
      const pc = bindPeerConnection(targetPeerId, socket, iceServers);
      const stream = await acquireLocalMedia();
      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode('user');
      void canFlipCamera().then(setCanSwitchCamera);
      // Offerer: attach first so createOffer advertises sendrecv A/V.
      await attachLocalTracks(pc, stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:initiate', {
        to: targetPeerId,
        offer: sessionDescriptionPayload(pc.localDescription ?? offer),
      });
    },
    [socket, bindPeerConnection],
  );

  const answerCall = useCallback(
    async (
      offer: RTCSessionDescriptionInit,
      remotePeerId: string,
    ): Promise<RTCSessionDescriptionInit> => {
      if (!socket) throw new Error('signalling_unavailable');
      await waitForSocket(socket);

      isCallerRef.current = false;
      const iceServers = await getIceServers();
      const pc = bindPeerConnection(remotePeerId, socket, iceServers);
      const stream = await acquireLocalMedia();
      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode('user');
      void canFlipCamera().then(setCanSwitchCamera);

      // Answerer MUST apply the remote offer before attaching local tracks.
      // Pre-offer addTransceiver/addTrack creates extra m-lines → blank remote A/V.
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIce(pc, remotePeerId);
      // Await track attach so createAnswer advertises sendrecv (not recvonly).
      await attachLocalTracks(pc, stream);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return sessionDescriptionPayload(pc.localDescription ?? answer);
    },
    [socket, bindPeerConnection, flushPendingIce],
  );

  const endCall = useCallback(() => {
    const target = remotePeerRef.current ?? peerId;
    if (target && socket) {
      socket.emit('call:end', { to: target });
    }
    if (target) {
      earlyIceByPeerRef.current.delete(target);
    }
    releaseMedia();
    resetCall();
  }, [peerId, socket, resetCall, releaseMedia]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((value) => !value);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsCameraOff((value) => !value);
  }, []);

  const switchCamera = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream || isSwitchingCamera) return;

    const prevFacing = facingMode;
    const nextFacing: CameraFacing = facingMode === 'user' ? 'environment' : 'user';

    setIsSwitchingCamera(true);
    try {
      const nextStream = await flipLocalCamera(pc, stream, nextFacing);
      localStreamRef.current = nextStream;
      setLocalStream(nextStream);
      setFacingMode(nextFacing);
    } catch {
      try {
        const restored = await flipLocalCamera(pc, localStreamRef.current ?? stream, prevFacing);
        localStreamRef.current = restored;
        setLocalStream(restored);
        setFacingMode(prevFacing);
      } catch {
        /* keep stream without video if both fail */
      }
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [facingMode, isSwitchingCamera]);

  useEffect(() => {
    if (!socket) return;

    const onAnswered = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        // Ignore answers if we are not the caller (glare / duplicate).
        if (!isCallerRef.current && pc.signalingState === 'stable' && pc.currentRemoteDescription) {
          setConnected();
          return;
        }
        if (pc.signalingState === 'stable' && pc.currentRemoteDescription) {
          setConnected();
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        const peer = remotePeerRef.current;
        await flushPendingIce(pc, peer ?? undefined);
        setConnected();
      } catch (err) {
        console.error('[webrtc] setRemoteDescription(answer) failed', err);
        setCallSetupError('Could not connect the video call. Try again.');
        releaseMedia();
        resetCall();
      }
    };

    const onIceCandidate = async ({
      candidate,
      from,
    }: {
      candidate: RTCIceCandidateInit;
      from?: string;
    }) => {
      if (!isUsableIceCandidate(candidate)) return;
      const pc = pcRef.current;
      const peerKey = from || remotePeerRef.current;

      if (!pc) {
        if (!peerKey) return;
        const list = earlyIceByPeerRef.current.get(peerKey) ?? [];
        list.push(candidate);
        earlyIceByPeerRef.current.set(peerKey, list);
        return;
      }

      if (!pc.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore stale candidates */
      }
    };

    const onEnded = () => {
      releaseMedia();
      resetCall();
    };

    const onRejected = () => {
      releaseMedia();
      resetCall();
      setCallSetupError('Call declined');
    };

    const onCallError = ({ error }: { error?: string }) => {
      releaseMedia();
      resetCall();
      if (error === 'target_offline') {
        setCallSetupError(
          'They are offline. Ask them to open menrush.com, stay on the app, then try again.',
        );
      } else if (
        error === 'call_not_allowed' ||
        error === 'target_not_authorized' ||
        error === 'match_required'
      ) {
        setCallSetupError('You need a mutual match before video calling.');
      } else if (error === 'invalid_target') {
        setCallSetupError('Could not start the video call');
      } else {
        setCallSetupError('Could not connect the video call. Try again.');
      }
    };

    // ICE restart reuses call:initiate → callee may receive a new offer while connected.
    const onIncomingRenegotiate = async ({
      from,
      offer,
    }: {
      from: string;
      fromName?: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      const pc = pcRef.current;
      if (!pc || isCallerRef.current) return;
      if (remotePeerRef.current && remotePeerRef.current !== from) return;
      // Only handle renegotiation when already in a call (stable + remote set).
      if (!pc.currentRemoteDescription || pc.signalingState === 'closed') return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIce(pc, from);
        // Local tracks already on senders from the initial answer — do not
        // addTransceiver again or renegotiation will duplicate m-lines.
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:answer', {
          to: from,
          answer: sessionDescriptionPayload(pc.localDescription ?? answer),
        });
      } catch (err) {
        console.error('[webrtc] renegotiation answer failed', err);
      }
    };

    socket.on('call:answered', onAnswered);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:ended', onEnded);
    socket.on('call:rejected', onRejected);
    socket.on('call:error', onCallError);
    socket.on('call:incoming', onIncomingRenegotiate);

    return () => {
      socket.off('call:answered', onAnswered);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:ended', onEnded);
      socket.off('call:rejected', onRejected);
      socket.off('call:error', onCallError);
      socket.off('call:incoming', onIncomingRenegotiate);
    };
  }, [socket, setConnected, resetCall, releaseMedia, setCallSetupError, flushPendingIce]);

  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      releaseMedia();
    }
  }, [callStatus, releaseMedia]);

  return {
    localStream,
    remoteStream,
    callStatus,
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
  };
}
