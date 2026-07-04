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

function createRemoteStream(): MediaStream {
  return new MediaStream();
}

export function useWebRTC() {
  const socket = useSocket();
  const { callStatus, peerId, setConnected, resetCall, setCallSetupError } = useCallStore();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remotePeerRef = useRef<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacing>('user');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
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
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    pcRef.current?.close();
    pcRef.current = null;
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

  const bindPeerConnection = useCallback(
    (remotePeerId: string, activeSocket: Socket, iceServers: RTCIceServer[]) => {
      remotePeerRef.current = remotePeerId;
      pendingIceRef.current = [];

      const pc = createPeerConnection(iceServers);
      const rs = createRemoteStream();
      remoteStreamRef.current = rs;
      setRemoteStream(rs);

      pc.ontrack = (ev) => {
        ev.streams[0]?.getTracks().forEach((track) => rs.addTrack(track));
        const next = new MediaStream(rs.getTracks());
        remoteStreamRef.current = next;
        setRemoteStream(next);
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        activeSocket.emit('call:ice-candidate', {
          to: remotePeerId,
          candidate: ev.candidate,
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
    [releaseMedia, resetCall, setCallSetupError],
  );

  const attachLocalTracks = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
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

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:initiate', { to: targetPeerId, offer });
    },
    [socket, bindPeerConnection, attachLocalTracks],
  );

  const answerCall = useCallback(
    async (offer: RTCSessionDescriptionInit, remotePeerId: string): Promise<RTCSessionDescriptionInit> => {
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
      await flushPendingIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    },
    [socket, bindPeerConnection, attachLocalTracks, flushPendingIce],
  );

  const endCall = useCallback(() => {
    const target = remotePeerRef.current ?? peerId;
    if (target && socket) {
      socket.emit('call:end', { to: target });
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

    const nextFacing: CameraFacing = facingMode === 'user' ? 'environment' : 'user';
    const oldVideoTrack = stream.getVideoTracks()[0];
    const wasEnabled = oldVideoTrack?.enabled ?? true;

    setIsSwitchingCamera(true);
    try {
      const newTrack = await acquireVideoTrackForFacing(nextFacing);
      newTrack.enabled = wasEnabled;
      const nextStream = await replaceLocalVideoTrack(pc, stream, newTrack);
      localStreamRef.current = nextStream;
      setLocalStream(nextStream);
      setFacingMode(nextFacing);
    } catch {
      /* keep current camera if switch fails */
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [facingMode, isSwitchingCamera]);

  useEffect(() => {
    if (!socket) return;

    const onAnswered = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingIce(pc);
      setConnected();
    };

    const onIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
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
