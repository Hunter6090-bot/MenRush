import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getPhotoUrl } from '../components/UserAvatar';
import { useSocket } from './useSocket';
import {
  acquireLocalMedia,
  attachLocalTracks,
  createPeerConnection,
  getIceServers,
  waitForSocket,
} from '../lib/webrtcCall';

export interface RoomParticipant {
  user_id: string;
  name: string;
  photo_url?: string | null;
  isLive?: boolean;
  isMuted?: boolean;
  isSelf?: boolean;
}

interface UseRoomVideoOptions {
  roomId?: string;
  userId?: string;
  enabled?: boolean;
}

interface PeerSlot {
  pc: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
  makingOffer: boolean;
  polite: boolean;
}

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
  if (typeof candidate.candidate === 'string' && candidate.candidate.trim() === '') {
    return false;
  }
  return true;
}

/** Lower user id creates the offer — avoids glare when both join at once. */
function isPolitePeer(myId: string, peerId: string): boolean {
  return myId > peerId;
}

function shouldCreateOffer(myId: string, peerId: string): boolean {
  return myId < peerId;
}

export function useRoomVideo({ roomId, userId, enabled = true }: UseRoomVideoOptions) {
  const socket = useSocket();
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [cameraOn, setCameraOn] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerSlot>>(new Map());
  const earlyIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());
  const iceServersRef = useRef<RTCIceServer[] | null>(null);
  const roomIdRef = useRef(roomId);
  const userIdRef = useRef(userId);
  const socketRef = useRef<Socket | null>(socket);

  roomIdRef.current = roomId;
  userIdRef.current = userId;
  socketRef.current = socket;

  const publishRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => ({
      ...prev,
      // Fresh MediaStream identity so React rebinds video when tracks update.
      [peerId]: new MediaStream(stream.getTracks()),
    }));
  }, []);

  const clearRemoteStream = useCallback((peerId: string) => {
    setRemoteStreams((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const closePeer = useCallback(
    (peerId: string) => {
      const slot = peersRef.current.get(peerId);
      if (slot) {
        try {
          slot.pc.ontrack = null;
          slot.pc.onicecandidate = null;
          slot.pc.onnegotiationneeded = null;
          slot.pc.close();
        } catch {
          /* ignore */
        }
        peersRef.current.delete(peerId);
      }
      earlyIceRef.current.delete(peerId);
      clearRemoteStream(peerId);
    },
    [clearRemoteStream],
  );

  const closeAllPeers = useCallback(() => {
    for (const peerId of Array.from(peersRef.current.keys())) {
      closePeer(peerId);
    }
  }, [closePeer]);

  const flushPendingIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    const early = earlyIceRef.current.get(peerId) ?? [];
    earlyIceRef.current.delete(peerId);
    const slot = peersRef.current.get(peerId);
    const pending = [...(slot?.pendingIce ?? []), ...early];
    if (slot) slot.pendingIce = [];
    for (const candidate of pending) {
      if (!isUsableIceCandidate(candidate)) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore stale */
      }
    }
  }, []);

  const emitMediaState = useCallback(
    (muted: boolean, camOn: boolean) => {
      const activeSocket = socketRef.current;
      const rid = roomIdRef.current;
      if (!activeSocket || !rid) return;
      activeSocket.emit('room:media-state', {
        roomId: rid,
        muted,
        cameraOn: camOn,
      });
    },
    [],
  );

  const ensurePeer = useCallback(
    async (peerId: string, options?: { initiate?: boolean }) => {
      const myId = userIdRef.current;
      const rid = roomIdRef.current;
      const activeSocket = socketRef.current;
      const local = streamRef.current;
      if (!myId || !rid || !activeSocket || !local || peerId === myId) return;

      let slot = peersRef.current.get(peerId);
      if (!slot) {
        if (!iceServersRef.current) {
          iceServersRef.current = await getIceServers();
        }
        const pc = createPeerConnection(iceServersRef.current);
        const polite = isPolitePeer(myId, peerId);
        slot = { pc, pendingIce: [], makingOffer: false, polite };
        peersRef.current.set(peerId, slot);

        pc.ontrack = (ev) => {
          const track = ev.track;
          if (!track) return;
          let inbound = ev.streams[0] ?? new MediaStream();
          if (!inbound.getTracks().some((t) => t.id === track.id)) {
            try {
              inbound.addTrack(track);
            } catch {
              inbound = new MediaStream([...inbound.getTracks(), track]);
            }
          }
          publishRemoteStream(peerId, inbound);
          track.addEventListener('unmute', () => {
            publishRemoteStream(peerId, inbound);
          });
        };

        pc.onicecandidate = (ev) => {
          if (!ev.candidate || !isUsableIceCandidate(iceCandidatePayload(ev.candidate))) return;
          activeSocket.emit('room:webrtc-ice', {
            roomId: rid,
            to: peerId,
            candidate: iceCandidatePayload(ev.candidate),
          });
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            // Keep slot for a soft reconnect attempt via re-offer from the impolite side.
            if (pc.connectionState === 'closed') {
              closePeer(peerId);
            }
          }
        };
      }

      const wantOffer =
        options?.initiate === true ||
        (options?.initiate !== false && shouldCreateOffer(myId, peerId));

      if (!wantOffer) return;
      if (slot.makingOffer) return;
      if (slot.pc.signalingState !== 'stable') return;

      slot.makingOffer = true;
      try {
        // Offerer attaches local tracks before createOffer (m-line order).
        await attachLocalTracks(slot.pc, local);
        const offer = await slot.pc.createOffer();
        await slot.pc.setLocalDescription(offer);
        activeSocket.emit('room:webrtc-offer', {
          roomId: rid,
          to: peerId,
          offer: sessionDescriptionPayload(slot.pc.localDescription ?? offer),
        });
      } catch (err) {
        console.error('[room-webrtc] createOffer failed', peerId, err);
      } finally {
        const current = peersRef.current.get(peerId);
        if (current) current.makingOffer = false;
      }
    },
    [closePeer, publishRemoteStream],
  );

  const upsertParticipant = useCallback((entry: RoomParticipant) => {
    setParticipants((prev) => {
      const idx = prev.findIndex((p) => p.user_id === entry.user_id);
      if (idx === -1) return [...prev, { ...entry, isLive: true }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...entry, isLive: true };
      return next;
    });
  }, []);

  const markOffline = useCallback(
    (offlineUserId: string) => {
      setParticipants((prev) =>
        prev.map((p) => (p.user_id === offlineUserId ? { ...p, isLive: false } : p)),
      );
      closePeer(offlineUserId);
    },
    [closePeer],
  );

  const replaceLocalTracksOnPeers = useCallback(async (stream: MediaStream) => {
    for (const [, slot] of peersRef.current) {
      try {
        await attachLocalTracks(slot.pc, stream);
        for (const track of stream.getTracks()) {
          const sender = slot.pc.getSenders().find((s) => s.track?.kind === track.kind);
          if (sender && sender.track?.id !== track.id) {
            await sender.replaceTrack(track);
          }
        }
      } catch {
        /* ignore per-peer replace failures */
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!enabled || !roomId) return;
    setMediaError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMediaError('Group video needs HTTPS and camera access.');
      setCameraOn(false);
      return;
    }
    try {
      // iOS Safari: keep getUserMedia early in this call stack (no await before it).
      const stream = await acquireLocalMedia();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setLocalStream(stream);
      setCameraOn(true);
      setMicMuted(false);
      await replaceLocalTracksOnPeers(stream);

      const activeSocket = socketRef.current;
      if (activeSocket) {
        try {
          await waitForSocket(activeSocket);
        } catch {
          /* still allow local preview */
        }
      }

      // Answer offers that arrived before getUserMedia finished.
      const pending = Array.from(pendingOffersRef.current.entries());
      pendingOffersRef.current.clear();
      for (const [peerId, offer] of pending) {
        try {
          await ensurePeer(peerId, { initiate: false });
          const slot = peersRef.current.get(peerId);
          if (!slot) continue;
          await slot.pc.setRemoteDescription(new RTCSessionDescription(offer));
          await flushPendingIce(peerId, slot.pc);
          await attachLocalTracks(slot.pc, stream);
          const answer = await slot.pc.createAnswer();
          await slot.pc.setLocalDescription(answer);
          activeSocket?.emit('room:webrtc-answer', {
            roomId: roomIdRef.current,
            to: peerId,
            answer: sessionDescriptionPayload(slot.pc.localDescription ?? answer),
          });
        } catch (err) {
          console.error('[room-webrtc] delayed offer answer failed', peerId, err);
        }
      }

      emitMediaState(false, true);
    } catch (error: unknown) {
      setCameraOn(false);
      const name = (error as { name?: string })?.name;
      setMediaError(
        name === 'NotAllowedError'
          ? 'Camera access was blocked.'
          : 'Could not start your camera.',
      );
    }
  }, [enabled, roomId, replaceLocalTracksOnPeers, emitMediaState, ensurePeer, flushPendingIce]);

  // Once local media is live, mesh to every other live participant.
  useEffect(() => {
    if (!localStream || !userId) return;
    for (const p of participants) {
      if (p.isLive && p.user_id !== userId) {
        void ensurePeer(p.user_id);
      }
    }
  }, [localStream, participants, userId, ensurePeer]);

  const stopCamera = useCallback(() => {
    closeAllPeers();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setCameraOn(false);
    emitMediaState(true, false);
  }, [closeAllPeers, emitMediaState]);

  const toggleCamera = useCallback(() => {
    if (!localStream) {
      void startCamera();
      return;
    }
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
    emitMediaState(micMuted, track.enabled);
  }, [localStream, startCamera, micMuted, emitMediaState]);

  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const muted = !track.enabled;
    setMicMuted(muted);
    emitMediaState(muted, cameraOn);
  }, [localStream, cameraOn, emitMediaState]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    void startCamera();
    return () => {
      closeAllPeers();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // Intentionally only re-run on room/enabled — not on startCamera identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId]);

  useEffect(() => {
    if (!userId) return;
    setParticipants((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, isSelf: true, isLive: true } : p)),
    );
  }, [userId]);

  const loadMembers = useCallback(
    (members: Array<{ id: string; name: string; photo_url?: string }>) => {
      setParticipants((prev) => {
        const liveMap = new Map(prev.map((p) => [p.user_id, p]));
        return members.map((m) => {
          const existing = liveMap.get(m.id);
          return {
            user_id: m.id,
            name: m.name,
            photo_url: m.photo_url,
            isLive: existing?.isLive ?? false,
            isMuted: existing?.isMuted ?? false,
            isSelf: m.id === userId,
          };
        });
      });
    },
    [userId],
  );

  const applyPresenceSync = useCallback(
    (list: Array<{ user_id: string; name: string; photo_url?: string | null }>) => {
      setParticipants((prev) => {
        const byId = new Map(prev.map((p) => [p.user_id, p]));
        list.forEach((entry) => {
          byId.set(entry.user_id, {
            ...(byId.get(entry.user_id) ?? {
              user_id: entry.user_id,
              name: entry.name,
              photo_url: entry.photo_url,
            }),
            user_id: entry.user_id,
            name: entry.name,
            photo_url: entry.photo_url,
            isLive: true,
            isSelf: entry.user_id === userId,
          });
        });
        return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
      });

      // Mesh: open a PC toward every other live peer once we have local media.
      if (streamRef.current && userId) {
        for (const entry of list) {
          if (entry.user_id !== userId) {
            void ensurePeer(entry.user_id);
          }
        }
      }
    },
    [userId, ensurePeer],
  );

  // Socket: WebRTC mesh signaling + remote media state
  useEffect(() => {
    if (!socket || !roomId || !userId || !enabled) return;

    const onOffer = async ({
      room_id,
      from,
      offer,
    }: {
      room_id: string;
      from: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      if (room_id !== roomId || !from || from === userId || !offer) return;
      const local = streamRef.current;
      if (!local) {
        // Camera still starting — answer once local media is ready.
        pendingOffersRef.current.set(from, offer);
        return;
      }

      try {
        await ensurePeer(from, { initiate: false });
        let slot = peersRef.current.get(from);
        if (!slot) {
          await ensurePeer(from, { initiate: false });
          slot = peersRef.current.get(from);
        }
        if (!slot) return;

        const { pc, polite } = slot;
        const offerCollision =
          slot.makingOffer || pc.signalingState !== 'stable';

        if (offerCollision) {
          if (!polite) {
            // Impolite peer ignores colliding remote offer; our offer wins.
            return;
          }
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch {
            /* Safari may not support rollback — continue best-effort */
          }
        }

        // Answerer: setRemoteDescription BEFORE attachLocalTracks (m-line order).
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIce(from, pc);
        await attachLocalTracks(pc, local);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('room:webrtc-answer', {
          roomId,
          to: from,
          answer: sessionDescriptionPayload(pc.localDescription ?? answer),
        });
      } catch (err) {
        console.error('[room-webrtc] handle offer failed', from, err);
      }
    };

    const onAnswer = async ({
      room_id,
      from,
      answer,
    }: {
      room_id: string;
      from: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (room_id !== roomId || !from || !answer) return;
      const slot = peersRef.current.get(from);
      if (!slot) return;
      try {
        if (slot.pc.signalingState === 'stable' && slot.pc.currentRemoteDescription) return;
        await slot.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIce(from, slot.pc);
      } catch (err) {
        console.error('[room-webrtc] handle answer failed', from, err);
      }
    };

    const onIce = async ({
      room_id,
      from,
      candidate,
    }: {
      room_id: string;
      from: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (room_id !== roomId || !from || !isUsableIceCandidate(candidate)) return;
      const slot = peersRef.current.get(from);
      if (!slot) {
        const list = earlyIceRef.current.get(from) ?? [];
        list.push(candidate);
        earlyIceRef.current.set(from, list);
        return;
      }
      if (!slot.pc.remoteDescription) {
        slot.pendingIce.push(candidate);
        return;
      }
      try {
        await slot.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore */
      }
    };

    const onMediaState = ({
      room_id,
      user_id,
      muted,
      camera_on,
    }: {
      room_id: string;
      user_id: string;
      muted?: boolean;
      camera_on?: boolean;
    }) => {
      if (room_id !== roomId || !user_id || user_id === userId) return;
      setParticipants((prev) =>
        prev.map((p) =>
          p.user_id === user_id
            ? {
                ...p,
                isMuted: typeof muted === 'boolean' ? muted : p.isMuted,
                isLive: camera_on === false ? p.isLive : p.isLive,
              }
            : p,
        ),
      );
    };

    const onPeerJoined = (peerId: string) => {
      if (!streamRef.current || peerId === userId) return;
      void ensurePeer(peerId);
    };

    // Expose join hook for RoomChat presence handler via custom event pattern —
    // RoomChat already calls upsertParticipant; we also watch participants below.
    socket.on('room:webrtc-offer', onOffer);
    socket.on('room:webrtc-answer', onAnswer);
    socket.on('room:webrtc-ice', onIce);
    socket.on('room:media-state', onMediaState);

    // When RoomChat marks someone live via presence, connect if we have media.
    const onPresenceJoin = (data: { room_id: string; type: string; user_id: string }) => {
      if (data.room_id !== roomId || data.type !== 'join' || !data.user_id) return;
      onPeerJoined(data.user_id);
    };
    socket.on('room:presence', onPresenceJoin);

    return () => {
      socket.off('room:webrtc-offer', onOffer);
      socket.off('room:webrtc-answer', onAnswer);
      socket.off('room:webrtc-ice', onIce);
      socket.off('room:media-state', onMediaState);
      socket.off('room:presence', onPresenceJoin);
    };
  }, [socket, roomId, userId, enabled, ensurePeer, flushPendingIce]);

  const getStreamFor = useCallback(
    (participantId: string) => {
      if (participantId === userId) return localStream;
      return remoteStreams[participantId] ?? null;
    },
    [localStream, remoteStreams, userId],
  );

  return {
    participants,
    pinnedId,
    setPinnedId,
    localStream,
    cameraOn,
    micMuted,
    mediaError,
    upsertParticipant,
    markOffline,
    loadMembers,
    applyPresenceSync,
    getStreamFor,
    toggleCamera,
    toggleMic,
    startCamera,
    stopCamera,
    photoUrl: (url?: string | null) => getPhotoUrl(url ?? undefined),
  };
}
