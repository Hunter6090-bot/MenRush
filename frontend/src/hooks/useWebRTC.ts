import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useSocket } from './useSocket';
import { useCallStore } from './store';
import {
  acquireLocalMedia,
  acquireVideoTrackForFacing,
  canFlipCamera,
  createPeerConnection,
  getIceServers,
  replaceLocalVideoTrack,
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
    // Do not stop remote tracks that may still be owned by the peer connection receivers —
    // closing PC is enough; stop only local.
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    remotePeerRef.current = null;
    pendingIceRef.current = [];
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

  const bindPeerConnection = useCallback(
    (remotePeerId: string, activeSocket: Socket, iceServers: RTCIceServer[]) => {
      remotePeerRef.current = remotePeerId;
      pendingIceRef.current = [];

      const pc = createPeerConnection(iceServers);
      // Start with null remote — UI shows waiting until ontrack fires with real media.
      remoteStreamRef.current = null;
      setRemoteStream(null);

      pc.ontrack = (ev) => {
        const track = ev.track;
        if (!track) return;

        // Prefer the browser-provided remote stream (audio+video together).
        let inbound = ev.streams[0] ?? remoteStreamRef.current ?? new MediaStream();
        if (!inbound.getTracks().some((t) => t.id === track.id)) {
          try {
            inbound.addTrack(track);
          } catch {
            inbound = new MediaStream([...inbound.getTracks(), track]);
          }
        }

        publishRemoteStream(inbound);

        // Some devices fire muted tracks first; re-publish when media actually flows.
        track.addEventListener('unmute', () => {
          const current = remoteStreamRef.current;
          if (current) publishRemoteStream(current);
        });
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        activeSocket.emit('call:ice-candidate', {
          to: remotePeerId,
          candidate: iceCandidatePayload(ev.candidate),
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setCallSetupError(
            'Could not connect the call across networks. Check Wi‑Fi or mobile data and try again.',
          );
          releaseMedia();
          resetCall();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          setCallSetupError(
            'Video call could not get through your network. Try again in a moment.',
          );
          releaseMedia();
          resetCall();
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [publishRemoteStream, releaseMedia, resetCall, setCallSetupError],
  );

  const attachLocalTracks = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    for (const track of stream.getTracks()) {
      const already = pc.getSenders().some((sender) => sender.track?.id === track.id);
      if (!already) {
        pc.addTrack(track, stream);
      }
    }
  }, []);

  const startCall = useCallback(
    async (targetPeerId: string, _peerName: string) => {
      if (!socket) throw new Error('signalling_unavailable');
      await waitForSocket(socket);

      const iceServers = await getIceServers();
      const pc = bindPeerConnection(targetPeerId, socket, iceServers);
      const stream = await acquireLocalMedia();
      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode('user');
      void canFlipCamera().then(setCanSwitchCamera);
      attachLocalTracks(pc, stream);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      socket.emit('call:initiate', {
        to: targetPeerId,
        offer: sessionDescriptionPayload(pc.localDescription ?? offer),
      });
    },
    [socket, bindPeerConnection, attachLocalTracks],
  );

  const answerCall = useCallback(
    async (
      offer: RTCSessionDescriptionInit,
      remotePeerId: string,
    ): Promise<RTCSessionDescriptionInit> => {
      if (!socket) throw new Error('signalling_unavailable');
      await waitForSocket(socket);

      const iceServers = await getIceServers();
      const pc = bindPeerConnection(remotePeerId, socket, iceServers);
      const stream = await acquireLocalMedia();
      localStreamRef.current = stream;
      setLocalStream(stream);
      setFacingMode('user');
      void canFlipCamera().then(setCanSwitchCamera);
      attachLocalTracks(pc, stream);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Apply ICE that arrived while the phone was still ringing (before PC existed).
      await flushPendingIce(pc, remotePeerId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return sessionDescriptionPayload(pc.localDescription ?? answer);
    },
    [socket, bindPeerConnection, attachLocalTracks, flushPendingIce],
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
    const oldVideoTrack = stream.getVideoTracks()[0];
    const wasEnabled = oldVideoTrack?.enabled ?? true;

    setIsSwitchingCamera(true);
    try {
      // Must release the open lens before Android Chrome will honor facingMode.
      if (oldVideoTrack) {
        stream.removeTrack(oldVideoTrack);
      }
      const newTrack = await acquireVideoTrackForFacing(nextFacing, {
        stopTrackFirst: oldVideoTrack ?? null,
      });
      newTrack.enabled = wasEnabled;
      const nextStream = await replaceLocalVideoTrack(pc, stream, newTrack);
      localStreamRef.current = nextStream;
      setLocalStream(nextStream);
      setFacingMode(nextFacing);
    } catch {
      try {
        const restored = await acquireVideoTrackForFacing(prevFacing);
        restored.enabled = wasEnabled;
        const nextStream = await replaceLocalVideoTrack(pc, stream, restored);
        localStreamRef.current = nextStream;
        setLocalStream(nextStream);
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
        if (pc.signalingState === 'stable' && pc.currentRemoteDescription) {
          // Already applied (duplicate event) — still mark connected.
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
      if (!candidate) return;
      const pc = pcRef.current;
      const peerKey = from || remotePeerRef.current;

      // No PC yet (callee still on ring screen) — buffer by peer for answerCall.
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
      if (error === 'call_not_allowed' || error === 'target_not_authorized' || error === 'match_required') {
        setCallSetupError('You need a mutual match before video calling.');
      } else if (error === 'invalid_target') {
        setCallSetupError('Could not start the video call');
      } else {
        setCallSetupError('Could not connect the video call. Try again.');
      }
    };

    socket.on('call:answered', onAnswered);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:ended', onEnded);
    socket.on('call:rejected', onRejected);
    socket.on('call:error', onCallError);

    return () => {
      socket.off('call:answered', onAnswered);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:ended', onEnded);
      socket.off('call:rejected', onRejected);
      socket.off('call:error', onCallError);
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
