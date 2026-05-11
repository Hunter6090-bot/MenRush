import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';
import { useCallStore } from './store';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTC() {
  const socket = useSocket();
  const { callStatus, peerId, setConnected, resetCall } = useCallStore();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const rs = new MediaStream();
    setRemoteStream(rs);

    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((t) => rs.addTrack(t));
      setRemoteStream(new MediaStream(rs.getTracks()));
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && peerId) {
        socket?.emit('call:ice-candidate', {
          to: peerId,
          candidate: ev.candidate,
        });
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket, peerId]);

  const getLocalMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  // ── Initiate call ────────────────────────────────────────────────────────
  const startCall = useCallback(
    async (targetPeerId: string, _peerName: string) => {
      if (!socket) return;
      const pc = createPC();
      const stream = await getLocalMedia();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:initiate', { to: targetPeerId, offer });
    },
    [socket, createPC, getLocalMedia]
  );

  // ── Answer incoming call ─────────────────────────────────────────────────
  const answerCall = useCallback(
    async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> => {
      const pc = createPC();
      const stream = await getLocalMedia();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      return answer;
    },
    [createPC, getLocalMedia]
  );

  // ── End / cleanup ────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (peerId && socket) {
      socket.emit('call:end', { to: peerId });
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    resetCall();
  }, [peerId, socket, resetCall]);

  // ── Media toggles ────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((v) => !v);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsCameraOff((v) => !v);
  }, []);

  // ── Socket event listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onAnswered = async ({
      answer,
    }: {
      answer: RTCSessionDescriptionInit;
    }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setConnected();
    };

    const onIceCandidate = async ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stale candidates
      }
    };

    const onEnded = () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      setIsMuted(false);
      setIsCameraOff(false);
      resetCall();
    };

    socket.on('call:answered', onAnswered);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:answered', onAnswered);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:ended', onEnded);
    };
  }, [socket, setConnected, resetCall]);

  // Cleanup streams if callStatus transitions to ended/idle externally
  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setRemoteStream(null);
    }
  }, [callStatus]);

  return {
    localStream,
    remoteStream,
    callStatus,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleCamera,
    isMuted,
    isCameraOff,
  };
}
