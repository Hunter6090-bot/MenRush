import { useCallback, useEffect, useRef, useState } from 'react';
import { getPhotoUrl } from '../components/UserAvatar';

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

export function useRoomVideo({ roomId, userId, enabled = true }: UseRoomVideoOptions) {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  const upsertParticipant = useCallback((entry: RoomParticipant) => {
    setParticipants((prev) => {
      const idx = prev.findIndex((p) => p.user_id === entry.user_id);
      if (idx === -1) return [...prev, { ...entry, isLive: true }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...entry, isLive: true };
      return next;
    });
  }, []);

  const markOffline = useCallback((offlineUserId: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.user_id === offlineUserId ? { ...p, isLive: false } : p)),
    );
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      setLocalStream(stream);
      setCameraOn(true);
      setMicMuted(false);
    } catch (error: any) {
      setCameraOn(false);
      setMediaError(
        error?.name === 'NotAllowedError'
          ? 'Camera access was blocked.'
          : 'Could not start your camera.',
      );
    }
  }, [enabled, roomId]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
    setCameraOn(false);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStream) {
      void startCamera();
      return;
    }
    const track = localStream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }, [localStream, startCamera]);

  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicMuted(!track.enabled);
  }, [localStream]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    void startCamera();
    return () => stopCamera();
  }, [enabled, roomId, startCamera, stopCamera]);

  useEffect(() => {
    if (!userId) return;
    setParticipants((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, isSelf: true, isLive: true } : p)),
    );
  }, [userId]);

  const loadMembers = useCallback((members: Array<{ id: string; name: string; photo_url?: string }>) => {
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
  }, [userId]);

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
    },
    [userId],
  );

  const getStreamFor = useCallback(
    (participantId: string) => (participantId === userId ? localStream : null),
    [localStream, userId],
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
