import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { messagesAPI, usersAPI, meetAPI, MediaKind, MessageMediaKind, MessageDTO, MeetAgreementState } from '../api/client';
import { trackEventOnce } from '../observability/analytics';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore, useCallStore, useLocationStore, useUnreadStore } from '../hooks/store';
import { UserAvatar } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { PulseRing } from '../components/PulseRing';
import { getPhotoUrl } from '../components/UserAvatar';
import { FEATURES } from '../lib/featureFlags';
import { SelfieCaptureModal } from '../components/SelfieCaptureModal';
import { ChatSafetyMenu } from '../components/ChatSafetyMenu';
import { placeOutgoingCall } from '../lib/callBridge';
import { mapCallMediaError } from '../lib/callMedia';
import { MobileBackButton } from '../components/MobileBackButton';
import { MissedCallIcon } from '../components/MissedCallIcon';
import { isMissedCallMessage, MISSED_CALL_PREVIEW } from '../lib/missedCall';
import { openMapsDirections } from '../lib/maps';
import { parseLocationPayload } from '../lib/locationMessage';
import { getMatchCoordinates, hasVisibleMatchLocation } from '../lib/matchLiveLocation';
import { MatchChatLiveLocation } from '../components/MatchChatLiveLocation';

/** Local message shape — matches MessageDTO but tolerates partial server payloads. */
interface Message extends Partial<MessageDTO> {
  id?: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at?: string;
  media_type?: MessageMediaKind | null;
  media_url?: string | null;
  audio_duration_ms?: number | null;
  is_disappearing?: boolean;
  expires_at?: string | null;
  viewed_at?: string | null;
  max_views?: number | null;
  view_count?: number;
  remaining_views?: number | null;
  expired?: boolean;
}

/** Sender's chosen viewing rule for an outgoing image. */
type ViewRule = 'permanent' | 'once' | 'twice' | 'custom';

const VIEW_RULE_LABELS: Record<ViewRule, string> = {
  permanent: 'Keep in chat',
  once: 'View once',
  twice: 'View twice',
  custom: 'Limited views',
};

/** Map the chosen rule to the upload options understood by the API. */
function ruleToSendOptions(
  rule: ViewRule,
  customViews: number,
): { disappearing: boolean; maxViews?: number } {
  switch (rule) {
    case 'permanent':
      return { disappearing: false };
    case 'once':
      return { disappearing: true, maxViews: 1 };
    case 'twice':
      return { disappearing: true, maxViews: 2 };
    case 'custom':
      return { disappearing: true, maxViews: Math.min(20, Math.max(2, Math.round(customViews))) };
  }
}

/** Human label for how many views a recipient has left. */
function remainingViewsLabel(remaining: number | null | undefined, maxViews?: number | null): string {
  if (maxViews == null) return '';
  if (remaining == null) {
    if (maxViews === 1) return 'View once';
    return `${maxViews} views`;
  }
  if (remaining <= 0) return 'No views left';
  if (remaining === 1) return '1 view left';
  return `${remaining} views left`;
}

interface OtherUser {
  name: string;
  photo_url?: string;
  online?: boolean;
  last_seen?: string;
  live_location_sharing?: boolean;
  live_lat?: number | string | null;
  live_lng?: number | string | null;
  live_distance_km?: number | string | null;
  live_location_updated_at?: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function isSameDay(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function isWithdrawnMedia(msg: Message): boolean {
  return !!msg.withdrawn_at || (!!msg.expired && /withdrawn/i.test(msg.message || ''));
}

function canWithdrawMedia(msg: Message, userId?: string): boolean {
  return (
    !!msg.id &&
    msg.sender_id === userId &&
    !!msg.media_type &&
    !isWithdrawnMedia(msg) &&
    (!!msg.media_url || !!msg.is_disappearing)
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export const Messages = ({ embedded = false }: { embedded?: boolean }) => {
  const { otherId } = useParams<{ otherId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [mediaError, setMediaError] = useState('');
  // Image composer: hold the selected file for preview + view-rule choice
  // before sending (instead of sending immediately on pick).
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [viewRule, setViewRule] = useState<ViewRule>('once');
  const [customViews, setCustomViews] = useState(3);
  // Recipient image viewer (transient full-screen view of a disappearing image).
  const [viewerMsg, setViewerMsg] = useState<Message | null>(null);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [meetState, setMeetState] = useState<MeetAgreementState | null>(null);
  const [meetSubmitting, setMeetSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [safetyNotice, setSafetyNotice] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);
  // Ticks once a second so disappearing countdowns and burned states update.
  const [, setBurnTick] = useState(0);
  const socket = useSocket();
  const user = useAuthStore((s) => s.user);
  const { lat: selfLat, lng: selfLng } = useLocationStore();
  const { setCalling, setCallSetupError, resetCall } = useCallStore();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!otherId) return;
    messagesAPI.getConversation(otherId).then((r) => setMessages(r.data)).catch(() => {});
    usersAPI.getProfile(otherId).then((r) => setOtherUser(r.data)).catch(() => {});
    meetAPI.getState(otherId).then((r) => setMeetState(r.data)).catch(() => setMeetState(null));
    useUnreadStore.getState().clearUnreadFrom(otherId);
  }, [otherId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  useEffect(() => {
    if (!socket || !otherId) return;
    const onMatchLocation = (payload: {
      user_id: string;
      lat: number;
      lng: number;
      updated_at: string;
    }) => {
      if (payload.user_id !== otherId) return;
      setOtherUser((current) =>
        current
          ? {
              ...current,
              live_location_sharing: true,
              live_lat: payload.lat,
              live_lng: payload.lng,
              live_location_updated_at: payload.updated_at,
            }
          : current,
      );
    };
    socket.on('match:location', onMatchLocation);
    return () => {
      socket.off('match:location', onMatchLocation);
    };
  }, [socket, otherId]);

  useEffect(() => {
    if (!otherId) return;
    const refreshProfile = () => {
      usersAPI.getProfile(otherId).then((r) => setOtherUser(r.data)).catch(() => {});
    };
    const id = window.setInterval(refreshProfile, 20000);
    return () => window.clearInterval(id);
  }, [otherId]);

  useEffect(() => {
    if (!socket || !otherId) return;

    const onMessage = (data: Message) => {
      if (data.sender_id === otherId || data.receiver_id === otherId) {
        setMessages((prev) => [...prev, data]);
      }
    };
    const onTyping = ({ typing }: { typing: boolean }) => setIsOtherTyping(typing);
    const onViewed = (data: {
      id: string;
      viewed_at: string;
      expires_at: string | null;
      max_views?: number | null;
      view_count?: number;
      remaining_views?: number | null;
      expired?: boolean;
    }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.id ? { ...m, ...data } : m)),
      );
    };
    const onWithdrawn = (data: Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.id ? { ...m, ...data } : m)),
      );
    };
    const onMeetUpdated = (data: MeetAgreementState & { peer_id?: string }) => {
      if (data.peer_id === otherId || !data.peer_id) {
        setMeetState({
          my_confirmed: data.my_confirmed,
          peer_confirmed: data.peer_confirmed,
          mutual: data.mutual,
          my_confirmed_at: data.my_confirmed_at,
          peer_confirmed_at: data.peer_confirmed_at,
        });
      }
    };

    socket.on('message', onMessage);
    socket.on('typing', onTyping);
    socket.on('message:viewed', onViewed);
    socket.on('message:withdrawn', onWithdrawn);
    socket.on('meet:updated', onMeetUpdated);

    return () => {
      socket.off('message', onMessage);
      socket.off('typing', onTyping);
      socket.off('message:viewed', onViewed);
      socket.off('message:withdrawn', onWithdrawn);
      socket.off('meet:updated', onMeetUpdated);
    };
  }, [socket, otherId]);

  // Drive disappearing-message countdowns. 1Hz is enough — the burn window
  // is 10s, so users see the second-by-second tick clearly.
  useEffect(() => {
    const id = window.setInterval(() => setBurnTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-dismiss media error toasts so they don't stick around.
  useEffect(() => {
    if (!mediaError) return;
    const id = window.setTimeout(() => setMediaError(''), 4000);
    return () => window.clearTimeout(id);
  }, [mediaError]);

  useEffect(() => {
    if (!safetyNotice) return;
    const id = window.setTimeout(() => setSafetyNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [safetyNotice]);

  // Revoke any staged preview object URL when the component unmounts.
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitTyping = (typing: boolean) => {
    socket?.emit('typing', { receiver_id: otherId, typing });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    inputValueRef.current = e.target.value;
    setInput(e.target.value);
    emitTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 2000);
  };

  const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const normalizeImageFile = (file: File): File | null => {
    let type = file.type;
    if (!type) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
      else if (ext === 'png') type = 'image/png';
      else if (ext === 'webp') type = 'image/webp';
    }
    if (type === 'image/heic' || type === 'image/heif') {
      setMediaError(
        'HEIC photos are not supported here. Use Attach from gallery, or set iPhone Camera → Formats → Most Compatible.',
      );
      return null;
    }
    if (!type || !ACCEPTED_IMAGE_TYPES.includes(type)) {
      setMediaError('Only JPEG, PNG or WebP images can be attached.');
      return null;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMediaError('Image is too large (max 12 MB).');
      return null;
    }
    if (type === file.type && file.name) return file;
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    return new File([file], file.name || `photo.${ext}`, { type });
  };

  const stageImageFile = (file: File) => {
    const normalized = normalizeImageFile(file);
    if (!normalized || !otherId) return;
    setMediaError('');
    setPendingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(normalized);
    });
    setPendingImage(normalized);
    setViewRule('once');
  };

  // ── Media: gallery attach + in-app selfie camera ─────────────────────────
  const handleAttachClick = () => fileInputRef.current?.click();
  const handleCameraClick = () => setSelfieOpen(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stageImageFile(file);
  };

  const clearPendingImage = useCallback(() => {
    setPendingImage(null);
    setPendingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleSendPendingImage = async () => {
    if (!pendingImage || !otherId || uploadingMedia) return;
    const file = pendingImage;
    const { disappearing, maxViews } = ruleToSendOptions(viewRule, customViews);
    setMediaError('');
    setUploadingMedia(true);
    try {
      const res = await messagesAPI.sendMedia(otherId, file, {
        kind: 'image',
        disappearing,
        maxViews,
      });
      setMessages((prev) => [...prev, res.data]);
      clearPendingImage();
      trackEventOnce(
        'first_message_success',
        { kind: 'image', surface: 'direct_message' },
        'first_message_success',
      );
    } catch (err: any) {
      const code = err?.response?.data?.error;
      setMediaError(
        code === 'match_required' || code === 'A mutual match is required'
          ? 'You need a mutual match before sending photos.'
          : code || 'Failed to send photo',
      );
    } finally {
      setUploadingMedia(false);
    }
  };

  // ── Media: voice notes (tap to start, tap again to stop) ──────────────
  const handleStartRecording = useCallback(async () => {
    if (recording || uploadingMedia || !otherId) return;
    setMediaError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const duration = Date.now() - recordStartRef.current;
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        // Tear down the mic stream so the OS indicator goes away immediately.
        recordStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setRecording(false);
        setRecordSeconds(0);
        // Throw away accidental sub-second taps.
        if (duration < 800 || blob.size < 1000) return;
        setUploadingMedia(true);
        try {
          const res = await messagesAPI.sendMedia(otherId!, blob, {
            kind: 'audio',
            durationMs: duration,
          });
          setMessages((prev) => [...prev, res.data]);
        } catch (err: any) {
          setMediaError(err?.response?.data?.error || 'Failed to send voice note');
        } finally {
          setUploadingMedia(false);
        }
      };
      recordStartRef.current = Date.now();
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(
        () => setRecordSeconds((s) => Math.min(180, s + 1)),
        1000,
      );
      // Hard cap at 3 minutes.
      window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 180_000);
    } catch (err: any) {
      setMediaError('Microphone access denied.');
      setRecording(false);
    }
  }, [recording, uploadingMedia, otherId]);

  const handleStopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') mr.stop();
  }, []);

  // ── Consume one view of a disappearing image (recipient side) ─────────
  // Called by the viewer only after the image has loaded & become visible,
  // so a mere tap or a failed load never burns a view.
  const handleConsumeView = useCallback(async (id: string): Promise<Message | null> => {
    try {
      const res = await messagesAPI.markViewed(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...res.data } : m)));
      return res.data as Message;
    } catch {
      // Server already replies with the canonical row; silently ignore conflicts.
      return null;
    }
  }, []);

  const sendTextMessage = useCallback(
    async (raw: string) => {
      const current = raw.trim();
      if (!current || !otherId || !user || sending) return;

      emitTyping(false);
      if (typingTimer.current) clearTimeout(typingTimer.current);

      inputValueRef.current = '';
      setInput('');
      setSending(true);
      inputRef.current?.focus();

      try {
        const res = await messagesAPI.sendMessage(otherId, current);
        const saved: Message = res.data;
        setMessages((prev) => [...prev, saved]);
        trackEventOnce(
          'first_message_success',
          { kind: 'text', surface: 'direct_message' },
          'first_message_success',
        );
      } catch {
        inputValueRef.current = current;
        setInput(current);
      } finally {
        setSending(false);
      }
    },
    [otherId, user, sending, emitTyping],
  );

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault?.();
    await sendTextMessage(inputValueRef.current ?? input);
  };

  /** Direct, premium openers — never creepy. 18+ consent-first tone. */
  const ICEBREAKERS = [
    'Hey — saw you nearby. Free later?',
    'Your profile stood out. Up for a chat?',
    'What are you looking for tonight?',
  ] as const;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleWithdrawMedia = async (messageId: string) => {
    if (withdrawingId) return;
    setWithdrawingId(messageId);
    try {
      const res = await messagesAPI.withdrawMedia(messageId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...res.data } : m)));
    } catch {
      setMediaError('Could not withdraw that media.');
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleShareLocation = () => {
    if (!otherId || sharingLocation || uploadingMedia) return;

    if (!window.isSecureContext || !navigator.geolocation) {
      setMediaError('Location sharing needs HTTPS and a device with GPS.');
      return;
    }

    setSharingLocation(true);
    setMediaError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await messagesAPI.sendLocation(
            otherId,
            position.coords.latitude,
            position.coords.longitude,
          );
          setMessages((prev) => [...prev, res.data]);
        } catch {
          setMediaError('Could not share your location.');
        } finally {
          setSharingLocation(false);
        }
      },
      () => {
        setMediaError('Location permission was denied.');
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleMeetConfirm = async () => {
    if (!otherId || meetSubmitting) return;
    setMeetSubmitting(true);
    try {
      const res = await meetAPI.confirm(otherId);
      setMeetState(res.data);
    } catch {
      setMediaError('Could not confirm meet readiness.');
    } finally {
      setMeetSubmitting(false);
    }
  };

  const handleMeetRevoke = async () => {
    if (!otherId || meetSubmitting) return;
    setMeetSubmitting(true);
    try {
      const res = await meetAPI.revoke(otherId);
      setMeetState(res.data);
    } catch {
      setMediaError('Could not update meet readiness.');
    } finally {
      setMeetSubmitting(false);
    }
  };

  const handleStartVideoCall = async () => {
    if (!otherId) return;
    const peerName = otherUser?.name ?? 'Someone';
    setCallSetupError(null);
    setCalling(otherId, peerName);
    try {
      await placeOutgoingCall(otherId, peerName);
    } catch (error: unknown) {
      resetCall();
      setCallSetupError(mapCallMediaError(error));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={
        embedded
          ? 'flex h-full min-h-0 flex-col'
          : 'fixed inset-0 flex flex-col'
      }
      style={{ background: '#0D0A06' }}
    >

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className={`flex-shrink-0 flex items-center gap-2 border-b px-3 sm:px-4 ${
          embedded ? '' : 'pt-[env(safe-area-inset-top,0px)]'
        }`}
        style={{
          minHeight: embedded
            ? '4rem'
            : 'calc(4rem + env(safe-area-inset-top, 0px))',
          background: 'rgba(13,10,6,0.94)',
          borderColor: '#3D2B0E',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 20,
        }}
      >
        {!embedded ? (
          <MobileBackButton
            fallback="/conversations"
            onClick={() => navigate('/conversations')}
            className="-ml-1"
          />
        ) : null}

        {/* Avatar + name block — centered, tappable to open profile */}
        <button
          type="button"
          onClick={() => otherId && navigate(`/profile/${otherId}`)}
          aria-label={otherUser ? `Open ${otherUser.name}'s profile` : 'Open profile'}
          className="flex-1 flex items-center gap-3 min-w-0 text-left rounded-xl px-1 py-1 -mx-1 hover:bg-[#3D2B0E]/40 active:scale-[0.99] transition-all"
        >
          {otherUser ? (
            <>
              <UserAvatar
                name={otherUser.name}
                photoUrl={otherUser.photo_url}
                online={otherUser.online}
                size="sm"
              />
              <div className="min-w-0">
                <p
                  className="font-semibold text-sm leading-tight truncate"
                  style={{ color: '#F0E0C0', letterSpacing: '0.01em' }}
                >
                  {otherUser.name}
                </p>
                <StatusBadge
                  online={!!otherUser.online}
                  lastSeen={otherUser.last_seen}
                  className="mt-0.5"
                />
              </div>
            </>
          ) : (
            <p className="font-semibold text-sm" style={{ color: '#F0E0C0' }}>
              Conversation
            </p>
          )}
        </button>

        {FEATURES.videoCalls && (
          <>
            {/* Video call button */}
            <button
              onClick={() => void handleStartVideoCall()}
              aria-label="Start video call"
              className="flex-shrink-0 w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 mr-cta-gradient"
              style={{
                boxShadow: '0 2px 12px rgba(196,131,42,0.35)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 4px 20px rgba(196,131,42,0.55)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 2px 12px rgba(196,131,42,0.35)';
              }}
            >
              <VideoIcon className="w-4 h-4 text-white" />
            </button>
          </>
        )}

        {otherId && (
          <ChatSafetyMenu
            peerId={otherId}
            peerName={otherUser?.name ?? 'this user'}
            onNotice={(msg, tone = 'success') => setSafetyNotice({ msg, tone })}
            onBlocked={() => navigate('/conversations')}
          />
        )}
      </header>

      {safetyNotice && (
        <div
          className="flex-shrink-0 px-4 py-2 text-center text-xs font-medium border-b"
          style={{
            background:
              safetyNotice.tone === 'success' ? 'rgba(143,199,115,0.12)' : 'rgba(139,69,19,0.15)',
            borderColor: '#3D2B0E',
            color: safetyNotice.tone === 'success' ? '#8FC773' : '#F0E0C0',
          }}
        >
          {safetyNotice.msg}
        </div>
      )}

      {otherUser && hasVisibleMatchLocation(otherUser) ? (() => {
        const coords = getMatchCoordinates(otherUser);
        if (!coords) return null;
        return (
          <MatchChatLiveLocation
            peerName={otherUser.name}
            photoUrl={otherUser.photo_url}
            lat={coords.lat}
            lng={coords.lng}
            distanceKm={otherUser.live_distance_km}
            updatedAt={otherUser.live_location_updated_at}
            selfLat={selfLat}
            selfLng={selfLng}
          />
        );
      })() : null}

      {otherId && meetState && (
        <MeetConsentBar
          state={meetState}
          peerName={otherUser?.name ?? 'them'}
          submitting={meetSubmitting}
          onConfirm={handleMeetConfirm}
          onRevoke={handleMeetRevoke}
        />
      )}

      {/* ── Messages area ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollbarWidth: 'thin' }}
      >
        {messages.length === 0 && !sending && (
          <div
            className="flex flex-col items-center justify-center h-full select-none px-4"
            data-testid="chat-icebreakers"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: '#1E1508', border: '1px solid #3D2B0E' }}
            >
              <BubbleIcon className="w-8 h-8" style={{ color: '#C4832A', opacity: 0.5 }} />
            </div>
            <p className="font-medium text-sm" style={{ color: '#A89070' }}>
              No messages yet
            </p>
            <p className="text-xs mt-1 mb-4 text-center" style={{ color: '#6B5840' }}>
              Be direct. Consent first. 18+ only.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {ICEBREAKERS.map((line) => (
                <button
                  key={line}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendTextMessage(line)}
                  className="rounded-2xl border border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.1)] px-4 py-3 text-left text-[13px] font-medium text-[#F0E0C0] transition-colors hover:bg-[rgba(196,131,42,0.2)] disabled:opacity-50"
                >
                  {line}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.sender_id === user?.id;
          const prevMsg = messages[i - 1];
          const nextMsg = messages[i + 1];
          const showDateSep = !isSameDay(prevMsg?.created_at, msg.created_at);
          const showTail = !nextMsg || nextMsg.sender_id !== msg.sender_id;
          const isGrouped = prevMsg && prevMsg.sender_id === msg.sender_id && !showDateSep;

          if (isMissedCallMessage(msg)) {
            return (
              <React.Fragment key={msg.id ?? i}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px" style={{ background: '#3D2B0E' }} />
                    <span
                      className="text-[10px] font-semibold px-3 py-1 rounded-full"
                      style={{
                        background: '#1E1508',
                        border: '1px solid #3D2B0E',
                        color: '#A89070',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {formatDateLabel(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px" style={{ background: '#3D2B0E' }} />
                  </div>
                )}
                <div className="flex justify-center my-4" data-testid="missed-call-log">
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                    style={{
                      background: 'rgba(176,67,46,0.12)',
                      border: '1px solid rgba(217,106,82,0.35)',
                      color: '#D96A52',
                    }}
                  >
                    <MissedCallIcon size={14} className="shrink-0" />
                    <span className="text-xs font-semibold">{MISSED_CALL_PREVIEW}</span>
                    {msg.created_at && (
                      <span className="text-[10px] opacity-80">{formatTime(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={msg.id ?? i}>
              {/* Date separator */}
              {showDateSep && (
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px" style={{ background: '#3D2B0E' }} />
                  <span
                    className="text-[10px] font-semibold px-3 py-1 rounded-full"
                    style={{
                      background: '#1E1508',
                      border: '1px solid #3D2B0E',
                      color: '#A89070',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {formatDateLabel(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px" style={{ background: '#3D2B0E' }} />
                </div>
              )}

              {/* Message row */}
              <div
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
                  isGrouped ? 'mt-0.5' : 'mt-3'
                }`}
              >
                {/* Received: avatar placeholder for spacing */}
                {!isMine && (
                  <div className="w-7 flex-shrink-0 mr-2 flex items-end mb-1">
                    {showTail && (
                      otherUser?.photo_url ? (
                        <div
                          className="w-7 h-7 rounded-full overflow-hidden"
                          style={{ border: '1px solid #3D2B0E', flexShrink: 0 }}
                        >
                          <img
                            src={otherUser.photo_url}
                            alt={otherUser.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <SilhouetteAvatar size={28} variant="chat" />
                      )
                    )}
                  </div>
                )}

                <div
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[62%]`}
                >
                  {msg.media_type === 'image' ? (
                    <ImageBubble
                      msg={msg}
                      isMine={isMine}
                      showTail={showTail}
                      onOpen={setViewerMsg}
                      onWithdraw={
                        canWithdrawMedia(msg, user?.id)
                          ? () => msg.id && handleWithdrawMedia(msg.id)
                          : undefined
                      }
                      withdrawing={withdrawingId === msg.id}
                    />
                  ) : msg.media_type === 'audio' ? (
                    <AudioBubble
                      msg={msg}
                      isMine={isMine}
                      showTail={showTail}
                      onWithdraw={
                        canWithdrawMedia(msg, user?.id)
                          ? () => msg.id && handleWithdrawMedia(msg.id)
                          : undefined
                      }
                      withdrawing={withdrawingId === msg.id}
                    />
                  ) : msg.media_type === 'location' ? (
                    <LocationBubble
                      msg={msg}
                      isMine={isMine}
                      showTail={showTail}
                      peerName={otherUser?.name}
                    />
                  ) : (
                    <div
                      className="relative px-4 py-2.5 text-sm leading-relaxed"
                      style={
                        isMine
                          ? {
                              background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                              color: '#FFF5E6',
                              borderRadius: showTail
                                ? '18px 18px 4px 18px'
                                : '18px 18px 18px 18px',
                              boxShadow: '0 2px 12px rgba(196,131,42,0.28)',
                            }
                          : {
                              background: '#1E1508',
                              border: '1px solid #3D2B0E',
                              color: '#F0E0C0',
                              borderRadius: showTail
                                ? '18px 18px 18px 4px'
                                : '18px 18px 18px 18px',
                            }
                      }
                    >
                      {msg.message}
                    </div>
                  )}
                  {/* Timestamp */}
                  {showTail && (
                    <span
                      className="text-[10px] mt-1 px-1"
                      style={{ color: '#6B5035' }}
                    >
                      {formatTime(msg.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex justify-start mt-3">
            <div className="w-7 flex-shrink-0 mr-2" />
            <div
              className="px-4 py-3 rounded-[18px] rounded-bl-[4px] flex items-center gap-1.5"
              style={{
                background: '#1E1508',
                border: '1px solid #3D2B0E',
              }}
            >
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
              <span className="typing-dot w-2 h-2 rounded-full" style={{ background: '#C4832A' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-t px-4 py-3"
        style={{
          borderColor: '#3D2B0E',
          background: 'rgba(13,10,6,0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {mediaError && (
          <div
            className="mb-2 text-[11px] px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(196,131,42,0.12)',
              border: '1px solid rgba(196,131,42,0.35)',
              color: '#F0E0C0',
            }}
          >
            {mediaError}
          </div>
        )}

        {/* Hidden inputs — gallery picker vs front-camera capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Choose from gallery"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Image composer — preview + view-rule choice before sending */}
        {pendingImage && pendingPreviewUrl && (
          <ImageComposer
            previewUrl={pendingPreviewUrl}
            rule={viewRule}
            customViews={customViews}
            uploading={uploadingMedia}
            onRuleChange={setViewRule}
            onCustomViewsChange={setCustomViews}
            onCancel={clearPendingImage}
            onSend={handleSendPendingImage}
          />
        )}

        {recording ? (
          // Recording-only bar — Stop sends, Cancel discards.
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                recordChunksRef.current = []; // discard
                handleStopRecording();
              }}
              aria-label="Cancel recording"
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: '#1E1508', border: '1px solid #3D2B0E', color: '#A89070' }}
            >
              <CloseIcon className="w-4 h-4" />
            </button>
            <div
              className="flex-1 flex items-center gap-2 px-4 py-3 rounded-full"
              style={{ background: '#1E1508', border: '1px solid rgba(196,131,42,0.4)' }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: '#E5484D', boxShadow: '0 0 8px #E5484D' }}
              />
              <span className="text-xs" style={{ color: '#F0E0C0' }}>
                Recording… {formatDuration(recordSeconds * 1000)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleStopRecording}
              aria-label="Send voice note"
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #C4832A, #A45E18)',
                boxShadow: '0 2px 12px rgba(196,131,42,0.4)',
              }}
            >
              <SendIcon className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareLocation}
              disabled={uploadingMedia || sharingLocation || !!pendingImage}
              aria-label="Share location"
              title="Share location"
              className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 disabled:opacity-40 border border-nn-border bg-nn-card text-nn-copper"
            >
              <LocationPinIcon className="w-4 h-4" />
            </button>

            {/* Selfie — opens front camera on mobile */}
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={uploadingMedia || !!pendingImage}
              aria-label="Take selfie"
              title="Take selfie"
              className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 disabled:opacity-40 border border-nn-border bg-nn-card text-nn-copper"
            >
              <CameraIcon className="w-4 h-4" />
            </button>

            {/* Gallery / attachments */}
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={uploadingMedia || !!pendingImage}
              aria-label="Attach from gallery"
              title="Attach from gallery"
              className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 disabled:opacity-40 border border-nn-border bg-nn-card text-nn-copper"
            >
              <AttachIcon className="w-4 h-4" />
            </button>

            {/* Text input */}
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Say something direct."
                autoComplete="off"
                className="w-full text-sm px-5 py-3 rounded-full focus:outline-none transition-all duration-200"
                style={{
                  background: '#1E1508',
                  border: '1px solid #3D2B0E',
                  color: '#F0E0C0',
                  caretColor: '#C4832A',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(196,131,42,0.5)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,131,42,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1px solid #3D2B0E';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Voice note OR Send — switch based on whether there's text */}
            {input.trim() ? (
              <button
                type="submit"
                disabled={!input.trim() || sending}
                aria-label="Send message"
                className="flex-shrink-0 rounded-full px-5 py-2.5 text-sm font-bold mr-cta-gradient transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed min-h-[46px]"
              >
                {sending ? <PulseRing size={16} label="Sending" /> : 'Send'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={uploadingMedia}
                aria-label="Record voice note"
                title="Record voice note"
                className="flex-shrink-0 w-[46px] h-[46px] rounded-full flex items-center justify-center active:scale-95 disabled:opacity-40 mr-cta-gradient text-[#FFF6E6] shadow-[0_2px_12px_rgba(196,131,42,0.4)]"
              >
                <MicIcon className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Full-screen viewer for disappearing images (recipient) */}
      {viewerMsg && (
        <ImageViewer
          msg={viewerMsg}
          onConsume={handleConsumeView}
          onClose={() => setViewerMsg(null)}
        />
      )}

      <SelfieCaptureModal
        variant="compact"
        open={selfieOpen}
        onClose={() => setSelfieOpen(false)}
        onCapture={stageImageFile}
        onError={setMediaError}
      />

    </div>
  );
};

// ── Location share bubble ────────────────────────────────────────────────────

interface LocationBubbleProps {
  msg: Message;
  isMine: boolean;
  showTail: boolean;
  peerName?: string;
}

const LocationBubble: React.FC<LocationBubbleProps> = ({ msg, isMine, showTail, peerName }) => {
  const coords = parseLocationPayload(msg.media_type, msg.message);
  const label = isMine ? 'Shared location' : `${peerName ?? 'Match'}'s location`;

  const bubbleStyle = isMine
    ? {
        background: 'linear-gradient(135deg, #C4832A, #A45E18)',
        color: '#FFF5E6',
        borderRadius: showTail ? '18px 18px 4px 18px' : '18px',
        boxShadow: '0 2px 12px rgba(196,131,42,0.28)',
      }
    : {
        background: '#1E1508',
        border: '1px solid #3D2B0E',
        color: '#F0E0C0',
        borderRadius: showTail ? '18px 18px 18px 4px' : '18px',
      };

  return (
    <div className="relative px-4 py-3 text-sm leading-relaxed max-w-[240px]" style={bubbleStyle}>
      <div className="flex items-start gap-2">
        <LocationPinIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{label}</p>
          {coords ? (
            <p className="mt-1 text-[11px] opacity-80">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          ) : null}
        </div>
      </div>
      {coords ? (
        <button
          type="button"
          onClick={() => openMapsDirections(coords.lat, coords.lng, label)}
          className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-bold"
          style={
            isMine
              ? { background: 'rgba(13,10,6,0.22)', color: '#FFF5E6' }
              : { background: 'rgba(196,131,42,0.16)', color: '#C4832A', border: '1px solid rgba(196,131,42,0.35)' }
          }
        >
          Get directions
        </button>
      ) : (
        <p className="mt-2 text-[11px] opacity-70">Location unavailable</p>
      )}
    </div>
  );
};

// ── SVG Icons ────────────────────────────────────────────────────────────────

interface MeetConsentBarProps {
  state: MeetAgreementState;
  peerName: string;
  submitting: boolean;
  onConfirm: () => void;
  onRevoke: () => void;
}

const MeetConsentBar: React.FC<MeetConsentBarProps> = ({
  state,
  peerName,
  submitting,
  onConfirm,
  onRevoke,
}) => {
  if (state.mutual) {
    return (
      <div
        className="flex-shrink-0 px-4 py-2.5 border-b text-center"
        style={{ borderColor: '#3D2B0E', background: 'rgba(22,163,74,0.12)' }}
        data-testid="meet-consent-mutual"
      >
        <p className="text-xs font-semibold" style={{ color: '#86EFAC' }}>
          You both confirmed you&apos;re ready to meet — coordinate safely in public.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 px-4 py-3 border-b"
      style={{ borderColor: '#3D2B0E', background: 'rgba(30,21,8,0.95)' }}
      data-testid="meet-consent-bar"
    >
      <p className="text-xs font-semibold" style={{ color: '#F0E0C0' }}>
        Ready to meet?
      </p>
      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#A89070' }}>
        Confirm only when you&apos;re happy to arrange a meet-up with {peerName}. Both of you must
        agree before this shows as mutual.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {state.my_confirmed ? (
          <>
            <span className="text-[11px] font-medium" style={{ color: '#C4832A' }}>
              You confirmed · waiting for {peerName}
              {state.peer_confirmed ? '' : '…'}
            </span>
            <button
              type="button"
              onClick={onRevoke}
              disabled={submitting}
              className="text-[11px] font-semibold underline disabled:opacity-50"
              style={{ color: '#A89070' }}
            >
              Undo
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-xl px-3 py-2 text-[11px] font-bold disabled:opacity-50"
            style={{ background: '#C4832A', color: '#0D0A06' }}
          >
            {submitting ? 'Saving…' : "I'm ready to meet"}
          </button>
        )}
        {state.peer_confirmed && !state.my_confirmed && (
          <span className="text-[11px]" style={{ color: '#86EFAC' }}>
            {peerName} is ready — your turn
          </span>
        )}
      </div>
    </div>
  );
};

const WithdrawMediaButton: React.FC<{ onClick: () => void; loading?: boolean }> = ({
  onClick,
  loading,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    data-testid="withdraw-media"
    className="text-[10px] font-semibold underline disabled:opacity-50"
    style={{ color: '#A89070' }}
  >
    {loading ? 'Withdrawing…' : 'Withdraw media'}
  </button>
);

const VideoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8h8a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z"
    />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const BubbleIcon = ({
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
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

const LocationPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z"
    />
    <circle cx="12" cy="10" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h2l1.5-2h7L17 7h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <circle cx="12" cy="13" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AttachIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
    />
  </svg>
);

const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12a7 7 0 0014 0M12 19v3" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);

const FlameIcon = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg className={className} style={style} fill="currentColor" viewBox="0 0 24 24">
    <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 0 0 16 0c0-4.16-2-7.86-6.5-13.33z" />
  </svg>
);

function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return '0:00';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── ImageComposer ────────────────────────────────────────────────────────────
// Shown after the sender picks an image: a preview plus Telegram-style view-rule
// chips (keep / view once / view twice / limited) and Send / Cancel controls.

interface ImageComposerProps {
  previewUrl: string;
  rule: ViewRule;
  customViews: number;
  uploading: boolean;
  onRuleChange: (rule: ViewRule) => void;
  onCustomViewsChange: (n: number) => void;
  onCancel: () => void;
  onSend: () => void;
}

const ImageComposer: React.FC<ImageComposerProps> = ({
  previewUrl,
  rule,
  customViews,
  uploading,
  onRuleChange,
  onCustomViewsChange,
  onCancel,
  onSend,
}) => {
  const rules: ViewRule[] = ['permanent', 'once', 'twice', 'custom'];
  const ruleSummary =
    rule === 'permanent'
      ? 'Stays in the conversation'
      : rule === 'once'
        ? 'Disappears after 1 view'
        : rule === 'twice'
          ? 'Disappears after 2 views'
          : `Disappears after ${customViews} views`;

  return (
    <div
      className="mb-3 p-3 rounded-2xl"
      data-testid="image-composer"
      style={{ background: '#1E1508', border: '1px solid #3D2B0E' }}
    >
      <div className="flex gap-3">
        <img
          src={previewUrl}
          alt="Selected photo preview"
          data-testid="image-composer-preview"
          className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
          style={{ border: '1px solid #3D2B0E' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-2" style={{ color: '#F0E0C0' }}>
            Photo · <span data-testid="image-composer-rule">{VIEW_RULE_LABELS[rule]}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {rules.map((r) => {
              const active = r === rule;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRuleChange(r)}
                  data-testid={`rule-${r}`}
                  aria-pressed={active}
                  className="text-[11px] px-2.5 py-1 rounded-full transition-all active:scale-95"
                  style={{
                    background: active ? 'rgba(196,131,42,0.22)' : '#0D0A06',
                    border: `1px solid ${active ? '#C4832A' : '#3D2B0E'}`,
                    color: active ? '#F0E0C0' : '#A89070',
                  }}
                >
                  {VIEW_RULE_LABELS[r]}
                </button>
              );
            })}
          </div>
          {rule === 'custom' && (
            <div className="flex items-center gap-2 mt-2" data-testid="custom-views">
              <button
                type="button"
                aria-label="Fewer views"
                onClick={() => onCustomViewsChange(Math.max(2, customViews - 1))}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: '#0D0A06', border: '1px solid #3D2B0E', color: '#C4832A' }}
              >
                −
              </button>
              <span className="text-xs tabular-nums" style={{ color: '#F0E0C0' }}>
                {customViews} views
              </span>
              <button
                type="button"
                aria-label="More views"
                onClick={() => onCustomViewsChange(Math.min(20, customViews + 1))}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: '#0D0A06', border: '1px solid #3D2B0E', color: '#C4832A' }}
              >
                +
              </button>
            </div>
          )}
          <p className="text-[10px] mt-2" style={{ color: '#6B5035' }}>
            {ruleSummary}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={uploading}
          data-testid="image-composer-cancel"
          className="text-xs px-4 py-2 rounded-full disabled:opacity-40"
          style={{ background: '#0D0A06', border: '1px solid #3D2B0E', color: '#A89070' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={uploading}
          data-testid="image-composer-send"
          className="text-xs font-semibold px-5 py-2 rounded-full disabled:opacity-50 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #C4832A, #A45E18)',
            color: '#FFF5E6',
            boxShadow: '0 2px 12px rgba(196,131,42,0.4)',
          }}
        >
          {uploading ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
};

// ── ImageBubble ──────────────────────────────────────────────────────────────
// Permanent images render inline. Disappearing images render as a tappable
// card (recipient) or a status card (sender); tapping opens the viewer, which
// is the only place the photo is actually shown. Once views are exhausted both
// sides see a "No longer available" tombstone.

interface ImageBubbleProps {
  msg: Message;
  isMine: boolean;
  showTail: boolean;
  onOpen: (msg: Message) => void;
  onWithdraw?: () => void;
  withdrawing?: boolean;
}

const ImageBubble: React.FC<ImageBubbleProps> = ({
  msg,
  isMine,
  showTail,
  onOpen,
  onWithdraw,
  withdrawing,
}) => {
  const radius = showTail
    ? isMine
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px'
    : '18px';

  if (isWithdrawnMedia(msg)) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div
          className="px-4 py-3 flex items-center gap-2 text-xs"
          data-testid="media-withdrawn"
          style={{
            background: '#1E1508',
            border: '1px solid #3D2B0E',
            color: '#A89070',
            borderRadius: radius,
            minWidth: 200,
          }}
        >
          <FlameIcon className="w-4 h-4" />
          <span>{msg.message || 'Photo withdrawn'}</span>
        </div>
      </div>
    );
  }

  const isDisappearing = !!msg.is_disappearing;
  const isExhausted = !!msg.expired || (!isDisappearing ? false : !msg.media_url);
  const url = getPhotoUrl(msg.media_url || undefined);

  // Exhausted disappearing media → "No longer available" tombstone (both sides).
  if (isDisappearing && isExhausted) {
    return (
      <div
        className="px-4 py-3 flex items-center gap-2 text-xs"
        data-testid="image-unavailable"
        style={{
          background: '#1E1508',
          border: '1px solid #3D2B0E',
          color: '#A89070',
          borderRadius: radius,
          minWidth: 200,
        }}
      >
        <FlameIcon className="w-4 h-4" />
        <span>Photo no longer available</span>
      </div>
    );
  }

  // Permanent image → inline, always available.
  if (!isDisappearing) {
    if (!url) return null;
    return (
      <div className="flex flex-col items-end gap-1">
        <div
          className="relative overflow-hidden"
          data-testid="image-permanent"
          style={{
            background: '#1E1508',
            border: isMine ? 'none' : '1px solid #3D2B0E',
            borderRadius: radius,
            boxShadow: isMine ? '0 2px 12px rgba(196,131,42,0.28)' : 'none',
          }}
        >
          <img
            src={url}
            alt={msg.message || 'photo'}
            className="block max-w-[260px] max-h-[340px] object-cover cursor-zoom-in"
            onClick={() => onOpen(msg)}
          />
        </div>
        {onWithdraw && (
          <WithdrawMediaButton onClick={onWithdraw} loading={withdrawing} />
        )}
      </div>
    );
  }

  const remainingLabel = remainingViewsLabel(msg.remaining_views, msg.max_views);

  // Sender's own disappearing image → status card (not re-openable).
  if (isMine) {
    const opened = !!msg.viewed_at;
    const status = !opened
      ? 'Awaiting view'
      : msg.remaining_views != null && msg.remaining_views <= 0
        ? 'Viewed'
        : `Opened · ${remainingLabel}`;
    return (
      <div className="flex flex-col items-end gap-1">
        <div
          className="px-4 py-3 flex items-center gap-3 text-xs"
          data-testid="image-sent-status"
          style={{
            background: 'linear-gradient(135deg, #C4832A, #A45E18)',
            color: '#FFF5E6',
            borderRadius: radius,
            minWidth: 200,
            boxShadow: '0 2px 12px rgba(196,131,42,0.28)',
          }}
        >
          <FlameIcon className="w-4 h-4" />
          <div className="flex flex-col">
            <span className="font-semibold">Photo · {remainingViewsLabel(null, msg.max_views)}</span>
            <span style={{ color: 'rgba(255,245,230,0.8)' }}>{status}</span>
          </div>
        </div>
        {onWithdraw && (
          <WithdrawMediaButton onClick={onWithdraw} loading={withdrawing} />
        )}
      </div>
    );
  }

  // Recipient + disappearing + views remaining → tappable card. Tapping opens
  // the viewer; it does NOT consume a view until the image actually loads.
  return (
    <button
      type="button"
      onClick={() => onOpen(msg)}
      data-testid="image-locked"
      className="relative overflow-hidden flex items-center justify-center active:scale-[0.98] transition-transform"
      style={{
        width: 220,
        height: 220,
        background: 'linear-gradient(135deg, #1E1508 0%, #0D0A06 100%)',
        border: '1px solid #3D2B0E',
        borderRadius: radius,
      }}
      aria-label={`Tap to view photo (${remainingLabel})`}
    >
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(196,131,42,0.15)', border: '1px solid rgba(196,131,42,0.4)' }}
        >
          <FlameIcon className="w-5 h-5" style={{ color: '#C4832A' }} />
        </div>
        <p className="text-xs font-semibold" style={{ color: '#F0E0C0' }}>
          Tap to view
        </p>
        <p className="text-[10px]" style={{ color: '#A89070' }} data-testid="image-remaining">
          {remainingLabel}
        </p>
      </div>
    </button>
  );
};

// ── ImageViewer ──────────────────────────────────────────────────────────────
// Full-screen transient viewer for a disappearing image. A view is consumed
// only after the image has loaded and become visible (onLoad). A failed load
// shows a retry and never burns a view. After loading, the photo stays up for a
// viewing window so "view once" is actually viewable.

const VIEW_WINDOW_MS = 10_000;

interface ImageViewerProps {
  msg: Message;
  onConsume: (id: string) => Promise<Message | null>;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ msg, onConsume, onClose }) => {
  const isPermanent = !msg.is_disappearing || msg.max_views == null;
  const [status, setStatus] = useState<'loading' | 'shown' | 'error'>('loading');
  const [secondsLeft, setSecondsLeft] = useState(Math.round(VIEW_WINDOW_MS / 1000));
  const [meta, setMeta] = useState<{ remaining: number | null | undefined; max: number | null | undefined }>(
    { remaining: msg.remaining_views, max: msg.max_views },
  );
  const [imgAttempt, setImgAttempt] = useState(0);
  const consumedRef = useRef(false);
  const baseUrl = getPhotoUrl(msg.media_url || undefined);
  const url =
    baseUrl && imgAttempt > 0
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}_retry=${imgAttempt}`
      : baseUrl;

  // Disappearing images auto-close after the viewing window. Permanent images
  // stay open until the user closes them.
  useEffect(() => {
    if (status !== 'shown' || isPermanent) return;
    setSecondsLeft(Math.round(VIEW_WINDOW_MS / 1000));
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    const closer = window.setTimeout(onClose, VIEW_WINDOW_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(closer);
    };
  }, [status, isPermanent, onClose]);

  const handleLoad = async () => {
    if (consumedRef.current) {
      setStatus('shown');
      return;
    }
    setStatus('shown');
    // Permanent images don't consume a view.
    if (isPermanent || !msg.id) {
      consumedRef.current = true;
      return;
    }
    consumedRef.current = true;
    const updated = await onConsume(msg.id);
    if (updated) {
      setMeta({ remaining: updated.remaining_views, max: updated.max_views });
    } else {
      // Server rejected the consume — allow retry without burning a view locally.
      consumedRef.current = false;
    }
  };

  const handleError = () => {
    // Loading failed — do NOT consume a view; let the user retry or close.
    consumedRef.current = false;
    setStatus('error');
  };

  const handleRetry = () => {
    consumedRef.current = false;
    setStatus('loading');
    setImgAttempt((n) => n + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      data-testid="image-viewer"
      style={{ background: 'rgba(5,3,1,0.96)' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        data-testid="image-viewer-close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(30,21,8,0.9)', border: '1px solid #3D2B0E', color: '#F0E0C0' }}
      >
        <CloseIcon className="w-5 h-5" />
      </button>

      {status === 'error' ? (
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <FlameIcon className="w-8 h-8" style={{ color: '#C4832A' }} />
          <p className="text-sm" style={{ color: '#F0E0C0' }}>
            Couldn’t load this photo.
          </p>
          <p className="text-xs" style={{ color: '#A89070' }}>
            No view was used. Check your connection and try again.
          </p>
          <button
            type="button"
            data-testid="image-viewer-retry"
            onClick={handleRetry}
            className="text-xs font-semibold px-5 py-2 rounded-full mt-1"
            style={{ background: 'linear-gradient(135deg, #C4832A, #A45E18)', color: '#FFF5E6' }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {status === 'loading' && (
            <div className="absolute" data-testid="image-viewer-loading">
              <PulseRing size={28} label="Loading photo" />
            </div>
          )}
          {url && (
            <img
              key={imgAttempt}
              src={url}
              alt={msg.message || 'photo'}
              data-testid="image-viewer-img"
              draggable={false}
              onLoad={handleLoad}
              onError={handleError}
              className="max-w-[92vw] max-h-[78vh] object-contain select-none"
              style={{ opacity: status === 'shown' ? 1 : 0 }}
            />
          )}
          {status === 'shown' && !isPermanent && (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
              data-testid="image-viewer-meta"
            >
              <span
                className="text-[11px] px-3 py-1 rounded-full"
                style={{
                  background: 'rgba(30,21,8,0.9)',
                  border: '1px solid rgba(196,131,42,0.45)',
                  color: '#F0E0C0',
                }}
              >
                {remainingViewsLabel(meta.remaining, meta.max)} · closes in {secondsLeft}s
              </span>
              <span className="text-[10px]" style={{ color: '#6B5035' }}>
                Screenshots can’t be fully blocked on the web — view with trust.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── AudioBubble ──────────────────────────────────────────────────────────────
// Inline voice-note player with copper play/pause and duration tag.

interface AudioBubbleProps {
  msg: Message;
  isMine: boolean;
  showTail: boolean;
  onWithdraw?: () => void;
  withdrawing?: boolean;
}

const AudioBubble: React.FC<AudioBubbleProps> = ({ msg, isMine, showTail, onWithdraw, withdrawing }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const url = getPhotoUrl(msg.media_url || undefined);
  const duration = msg.audio_duration_ms ?? 0;
  const withdrawn = isWithdrawnMedia(msg);

  useEffect(() => {
    if (withdrawn) return;
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime * 1000);
    const onEnded = () => {
      setPlaying(false);
      setPosition(0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, [url, withdrawn]);

  const radius = showTail
    ? isMine
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px'
    : '18px';

  if (withdrawn) {
    return (
      <div
        className="px-4 py-3 text-xs"
        data-testid="media-withdrawn"
        style={{
          background: '#1E1508',
          border: '1px solid #3D2B0E',
          color: '#A89070',
          borderRadius: radius,
        }}
      >
        {msg.message || 'Voice note withdrawn'}
      </div>
    );
  }

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !url) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} gap-1`}>
      <div
        className="flex items-center gap-3 px-3 py-2.5"
      style={{
        background: isMine ? 'linear-gradient(135deg, #C4832A, #A45E18)' : '#1E1508',
        border: isMine ? 'none' : '1px solid #3D2B0E',
        color: isMine ? '#FFF5E6' : '#F0E0C0',
        borderRadius: radius,
        boxShadow: isMine ? '0 2px 12px rgba(196,131,42,0.28)' : 'none',
        minWidth: 200,
      }}
    >
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
        style={{
          background: isMine ? 'rgba(13,10,6,0.35)' : 'rgba(196,131,42,0.18)',
          color: isMine ? '#FFF5E6' : '#C4832A',
        }}
      >
        {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: isMine ? 'rgba(13,10,6,0.35)' : 'rgba(196,131,42,0.18)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${progressPct}%`,
              background: isMine ? '#FFF5E6' : '#C4832A',
              transition: 'width 120ms linear',
            }}
          />
        </div>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: isMine ? 'rgba(255,245,230,0.75)' : '#A89070' }}
        >
          {formatDuration(playing ? position : duration)}
        </span>
      </div>
      {url && <audio ref={audioRef} src={url} preload="metadata" />}
      </div>
      {onWithdraw && isMine && (
        <WithdrawMediaButton onClick={onWithdraw} loading={withdrawing} />
      )}
    </div>
  );
};
