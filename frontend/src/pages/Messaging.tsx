import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { messagesAPI, usersAPI, meetAPI, MediaKind, MessageMediaKind, MessageDTO, MeetAgreementState, LibraryPhotoDTO } from '../api/client';
import { trackEventOnce } from '../observability/analytics';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore, useCallStore, useUnreadStore } from '../hooks/store';
import { UserAvatar } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { PulseRing } from '../components/PulseRing';
import { getPhotoUrl } from '../components/UserAvatar';
import { FEATURES } from '../lib/featureFlags';
import { SelfieCaptureModal } from '../components/SelfieCaptureModal';
import { CameraCaptureChooser } from '../components/CameraCaptureChooser';
import { VideoNoteCaptureModal } from '../components/VideoNoteCaptureModal';
import { videoFileFromRecorderBlob } from '../lib/mediaMime';
import { ChatAttachLibrarySheet } from '../components/ChatAttachLibrarySheet';
import { ChatSafetyMenu } from '../components/ChatSafetyMenu';
import { PanicReportButton } from '../components/PanicReportButton';
import { placeOutgoingCall } from '../lib/callBridge';
import { mapCallMediaError } from '../lib/callMedia';
import { ChevronLeftIcon, MobileBackButton } from '../components/MobileBackButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { MissedCallIcon } from '../components/MissedCallIcon';
import { isMissedCallMessage, MISSED_CALL_PREVIEW } from '../lib/missedCall';
import { openMapsDirections } from '../lib/maps';
import { parseLocationPayload } from '../lib/locationMessage';
import { profilePathForUser } from '../lib/profileLinks';
import { ProfilePhotoLink } from '../components/ProfilePhotoLink';
import { SoftBlurMedia, shouldBlurMedia } from '../components/SoftBlurMedia';
import { compressChatImageFile } from '../lib/imageUpload';
import { armOverlayBack } from '../lib/overlayBack';
import { CHAT_IMAGE_VIEWER_FRAME } from '../lib/chatImageViewerFrame';
import {
  shouldLoadOlderOnScroll,
  shouldStickToBottomOnUpdate,
  restoreScrollAfterPrepend,
} from '../lib/chatScroll';
import {
  VIDEO_LOAD_TIMEOUT_MS,
  chatVideoUnsupportedHint,
  type ChatVideoLoadState,
} from '../lib/chatVideoPlayback';
import {
  appendUniqueMessage,
  CHAT_LIVE_REFRESH_EVENT,
  CONVERSATION_PAGE_SIZE,
  conversationFingerprint,
  mergeConversationRows,
  prependOlderMessages,
  sortMessagesChronologically,
} from '../lib/pushDeepLink';
import {
  appendCachedThreadMessage,
  isPreviewSeedMessage,
  readCachedThread,
  rememberInboxThread,
  stripPreviewSeedMessages,
  threadLikelyHasHistory,
  writeCachedThread,
} from '../lib/conversationHistoryCache';
import type { ThreadOpenState } from '../components/ConversationItem';

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
  media_clear?: boolean;
}

function seedThreadForOpen(
  peerId: string | undefined,
  selfId: string | undefined,
  nav: ThreadOpenState | null,
): Message[] {
  if (!peerId) return [];
  const preview = nav?.threadPreview;
  if (preview && preview.peerId === peerId && preview.lastMessage) {
    rememberInboxThread(peerId, {
      lastMessage: preview.lastMessage,
      lastMessageTime: preview.lastMessageTime,
      selfId,
    });
  }
  const cached = readCachedThread(peerId);
  return cached ? (cached as Message[]) : [];
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

/** Direct, premium openers — never creepy. 18+ consent-first tone. */
const ICEBREAKERS = [
  'Hey — saw you nearby. Free later?',
  'Your profile stood out. Up for a chat?',
  'What are you looking for tonight?',
] as const;

// ── Main component ───────────────────────────────────────────────────────────

export const Messages = ({ embedded = false }: { embedded?: boolean }) => {
  const { otherId } = useParams<{ otherId: string }>();
  const location = useLocation();
  const navState = (location.state as ThreadOpenState | null) || null;
  const user = useAuthStore((s) => s.user);
  // Seed from nav preview / session cache so existing threads never flash empty.
  const [messages, setMessages] = useState<Message[]>(() =>
    seedThreadForOpen(otherId, user?.id, navState),
  );
  const [historyReady, setHistoryReady] = useState(
    () => readCachedThread(otherId) !== undefined,
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(() => {
    const preview = navState?.threadPreview;
    if (preview && otherId && preview.peerId === otherId && preview.name) {
      return { name: preview.name, photo_url: preview.photoUrl };
    }
    return null;
  });
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [mediaError, setMediaError] = useState('');
  // Image composer: hold the selected file for preview + view-rule choice
  // before sending (instead of sending immediately on pick).
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingLibraryPhotos, setPendingLibraryPhotos] = useState<LibraryPhotoDTO[] | null>(null);
  const [pendingPreparing, setPendingPreparing] = useState(false);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [viewRule, setViewRule] = useState<ViewRule>('once');
  const [customViews, setCustomViews] = useState(3);
  // Recipient image viewer (transient full-screen view of a disappearing image).
  const [viewerMsg, setViewerMsg] = useState<Message | null>(null);
  const [cameraChooserOpen, setCameraChooserOpen] = useState(false);
  const [attachLibraryOpen, setAttachLibraryOpen] = useState(false);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [videoNoteOpen, setVideoNoteOpen] = useState(false);
  const [meetState, setMeetState] = useState<MeetAgreementState | null>(null);
  const [meetSubmitting, setMeetSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [safetyNotice, setSafetyNotice] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);
  // Disappearing countdown lives in ImageViewer only — do not 1Hz re-render the whole thread.
  const socket = useSocket();
  const { setCalling, setCallSetupError, resetCall } = useCallStore();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number | null>(null);
  /** Follow latest only while near the tip (or after own send). */
  const stickToBottomRef = useRef(true);
  /** One-shot: own send always snaps to latest even if reading history. */
  const forceStickAfterSendRef = useRef(false);
  /** scrollHeight before an older-page prepend — restore in useLayoutEffect. */
  const pendingPrependHeightRef = useRef<number | null>(null);
  const loadingOlderRef = useRef(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Append a confirmed server row to the open thread + session cache. */
  const commitThreadMessage = useCallback(
    (msg: Message) => {
      if (!otherId) return;
      setMessages((prev) => {
        const next = appendUniqueMessage(stripPreviewSeedMessages(prev), msg);
        appendCachedThreadMessage(otherId, msg);
        return next;
      });
      setHistoryReady(true);
    },
    [otherId],
  );

  const loadConversation = useCallback((opts?: { replace?: boolean }) => {
    if (!otherId) return;
    messagesAPI
      .getConversation(otherId)
      .then((r) => {
        const rows = Array.isArray(r.data) ? (r.data as Message[]) : [];
        if (opts?.replace) {
          setHasMoreOlder(rows.length >= CONVERSATION_PAGE_SIZE);
        }
        setMessages((prev) => {
          // Drop inbox preview seeds before merge so LIMIT-window union stays correct.
          const base = stripPreviewSeedMessages(prev);
          // Always normalize order: poll merge used to re-append rows that slid
          // out of the LIMIT page and jump earlier bubbles to the bottom.
          const next = opts?.replace
            ? sortMessagesChronologically(rows)
            : mergeConversationRows(base, rows);
          if (
            conversationFingerprint(base) === conversationFingerprint(next) &&
            base.length === prev.length
          ) {
            return prev;
          }
          writeCachedThread(otherId, next);
          return next;
        });
        setHistoryReady(true);
      })
      .catch(() => {
        if (opts?.replace) {
          // Keep any cached/preview paint; only clear when we had nothing to show.
          setMessages((prev) => {
            if (prev.length > 0) return prev;
            writeCachedThread(otherId, []);
            return [];
          });
          setHasMoreOlder(false);
          setHistoryReady(true);
        }
      });
  }, [otherId]);

  const markOwnSendStick = useCallback(() => {
    forceStickAfterSendRef.current = true;
    stickToBottomRef.current = true;
  }, []);

  const loadOlderMessages = useCallback(() => {
    if (!otherId || loadingOlderRef.current || !hasMoreOlder) return;
    // Skip inbox preview seeds — they are not real server message ids.
    const oldestId = messages.find((m) => m.id && !isPreviewSeedMessage(m))?.id;
    if (!oldestId) return;

    const scroller = messagesScrollRef.current;
    pendingPrependHeightRef.current = scroller?.scrollHeight ?? null;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    // Reading history — never snap to tip after this prepend.
    stickToBottomRef.current = false;

    messagesAPI
      .getConversation(otherId, { before: oldestId, limit: CONVERSATION_PAGE_SIZE })
      .then((r) => {
        const rows = Array.isArray(r.data) ? (r.data as Message[]) : [];
        if (rows.length < CONVERSATION_PAGE_SIZE) setHasMoreOlder(false);
        if (rows.length === 0) {
          pendingPrependHeightRef.current = null;
          return;
        }
        setMessages((prev) => {
          const next = prependOlderMessages(prev, rows);
          if (conversationFingerprint(prev) === conversationFingerprint(next)) {
            pendingPrependHeightRef.current = null;
            return prev;
          }
          writeCachedThread(otherId, next);
          return next;
        });
      })
      .catch(() => {
        pendingPrependHeightRef.current = null;
      })
      .finally(() => {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      });
  }, [otherId, hasMoreOlder, messages]);

  const handleThreadScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    stickToBottomRef.current = shouldStickToBottomOnUpdate(el);
    if (
      shouldLoadOlderOnScroll(el, {
        loading: loadingOlderRef.current,
        hasMore: hasMoreOlder,
      })
    ) {
      loadOlderMessages();
    }
  }, [hasMoreOlder, loadOlderMessages]);

  // Paint before browser paint: nav preview + session cache (survives lazy remount).
  useLayoutEffect(() => {
    if (!otherId) return;
    const seeded = seedThreadForOpen(otherId, user?.id, navState);
    if (seeded.length > 0) {
      setMessages(seeded);
      setHistoryReady(true);
    } else {
      const cached = readCachedThread(otherId);
      setMessages(cached ? (cached as Message[]) : []);
      setHistoryReady(cached !== undefined);
    }
    const preview = navState?.threadPreview;
    if (preview && preview.peerId === otherId && preview.name) {
      setOtherUser((prev) =>
        prev?.name
          ? prev
          : {
              name: preview.name,
              photo_url: preview.photoUrl,
            },
      );
    }
  }, [otherId, user?.id, navState]);

  useEffect(() => {
    if (!otherId) return;
    stickToBottomRef.current = true;
    forceStickAfterSendRef.current = false;
    pendingPrependHeightRef.current = null;
    loadingOlderRef.current = false;
    setHasMoreOlder(true);
    setLoadingOlder(false);
    setIsOtherTyping(false);
    // Keep any seeded preview while fetching; do not blank the thread.
    loadConversation({ replace: true });
    usersAPI
      .getProfile(otherId)
      .then((r) => {
        const data = r.data as OtherUser | null;
        if (data && typeof data === 'object' && typeof (data as OtherUser).name === 'string') {
          setOtherUser(data as OtherUser);
        }
      })
      .catch(() => {});
    meetAPI.getState(otherId).then((r) => setMeetState(r.data)).catch(() => setMeetState(null));
    useUnreadStore.getState().clearUnreadFrom(otherId);
  }, [otherId, loadConversation]);

  // Preserve visual position after older history is prepended (before paint).
  useLayoutEffect(() => {
    const prevHeight = pendingPrependHeightRef.current;
    const el = messagesScrollRef.current;
    if (prevHeight == null || !el) return;
    restoreScrollAfterPrepend(el, prevHeight);
    pendingPrependHeightRef.current = null;
    // Keep stick off — user was reading history.
    stickToBottomRef.current = false;
  }, [messages]);

  useEffect(() => {
    // Don't yank scroll while the photo viewer is open — restore on close instead.
    // Owner lock: while reading earlier history (not near latest edge), never
    // force scroll on poll / socket / merge / typing re-render.
    if (viewerMsg) return;
    // Avoid scrolling away a single inbox-preview seed before real history arrives.
    if (
      messages.length > 0 &&
      messages.every((m) => isPreviewSeedMessage(m))
    ) {
      return;
    }
    const force = forceStickAfterSendRef.current;
    if (!force && !stickToBottomRef.current) return;
    const stick = shouldStickToBottomOnUpdate(messagesScrollRef.current, { force });
    if (!stick) {
      stickToBottomRef.current = false;
      return;
    }
    forceStickAfterSendRef.current = false;
    stickToBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: force ? 'smooth' : 'auto' });
  }, [messages, isOtherTyping, viewerMsg]);

  const openImageViewer = useCallback((msg: Message) => {
    if (messagesScrollRef.current) {
      savedScrollTopRef.current = messagesScrollRef.current.scrollTop;
    }
    setViewerMsg(msg);
  }, []);

  const closeImageViewer = useCallback(() => {
    setViewerMsg(null);
    const top = savedScrollTopRef.current;
    if (top == null) return;
    requestAnimationFrame(() => {
      if (messagesScrollRef.current) {
        messagesScrollRef.current.scrollTop = top;
      }
    });
  }, []);

  useEffect(() => {
    if (!otherId) return;
    const refreshProfile = () => {
      usersAPI.getProfile(otherId).then((r) => setOtherUser(r.data)).catch(() => {});
    };
    const id = window.setInterval(refreshProfile, 60000);
    return () => window.clearInterval(id);
  }, [otherId]);

  // Live delivery while sitting in the thread: iPhone PWAs often keep the page
  // visible but miss the Socket.IO event (suspend / silent disconnect). Remount
  // fixed it because getConversation ran again — poll so we do not need leave/reenter.
  useEffect(() => {
    if (!otherId) return;
    const OPEN_THREAD_POLL_MS = 2500;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      loadConversation();
    };
    const id = window.setInterval(tick, OPEN_THREAD_POLL_MS);
    return () => window.clearInterval(id);
  }, [otherId, loadConversation]);

  // iPhone PWA: also refetch on visibility / reconnect / push hint (faster than poll).
  useEffect(() => {
    if (!otherId) return;

    const refreshIfVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      loadConversation();
    };

    const onLiveRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ otherId?: string | null }>).detail;
      if (detail?.otherId && detail.otherId !== otherId) return;
      refreshIfVisible();
    };

    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('pageshow', refreshIfVisible);
    window.addEventListener(CHAT_LIVE_REFRESH_EVENT, onLiveRefresh as EventListener);
    socket?.on('connect', refreshIfVisible);

    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('pageshow', refreshIfVisible);
      window.removeEventListener(CHAT_LIVE_REFRESH_EVENT, onLiveRefresh as EventListener);
      socket?.off('connect', refreshIfVisible);
    };
  }, [otherId, loadConversation, socket]);

  useEffect(() => {
    if (!socket || !otherId) return;

    const onMessage = (data: Message) => {
      if (data.sender_id === otherId || data.receiver_id === otherId) {
        setMessages((prev) => {
          const next = appendUniqueMessage(stripPreviewSeedMessages(prev), data);
          appendCachedThreadMessage(otherId, data);
          return next;
        });
        setHistoryReady(true);
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

  // Auto-dismiss media error toasts so they don't stick around.
  useEffect(() => {
    if (!mediaError) return;
    const id = window.setTimeout(() => setMediaError(''), 4000);
    return () => window.clearTimeout(id);
  }, [mediaError]);

  useEffect(() => {
    if (!safetyNotice) return;
    const id = window.setTimeout(() => setSafetyNotice(null), 7000);
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
    setViewRule('once');
    setPendingLibraryPhotos(null);
    setPendingPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(normalized);
    });
    setPendingImage(normalized);
    // Compress while the user picks view-once / send — Android originals
    // were multi‑MB and dominated the ~50s Al→Pete send.
    setPendingPreparing(true);
    void compressChatImageFile(normalized)
      .then((compressed) => {
        setPendingImage(compressed);
        setPendingPreviewUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return URL.createObjectURL(compressed);
        });
      })
      .catch(() => undefined)
      .finally(() => setPendingPreparing(false));
  };

  const stageLibraryPhotos = (photos: LibraryPhotoDTO[]) => {
    if (!photos.length || !otherId) return;
    setMediaError('');
    setViewRule('once');
    setPendingImage(null);
    setPendingPreparing(false);
    setPendingPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingLibraryPhotos(photos);
  };

  const clearPendingImage = useCallback(() => {
    setPendingImage(null);
    setPendingLibraryPhotos(null);
    setPendingPreparing(false);
    setPendingPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleSendPendingImage = async () => {
    if (!otherId || uploadingMedia) return;
    const { disappearing, maxViews } = ruleToSendOptions(viewRule, customViews);
    setMediaError('');
    setUploadingMedia(true);
    try {
      if (pendingLibraryPhotos && pendingLibraryPhotos.length > 0) {
        // Send selected library photos — album rows / visibility stay untouched.
        for (const photo of pendingLibraryPhotos) {
          const res = await messagesAPI.sendFromAlbum(otherId, photo.id, {
            disappearing,
            maxViews,
          });
          markOwnSendStick();
          commitThreadMessage(res.data);
        }
        clearPendingImage();
        trackEventOnce(
          'first_message_success',
          { kind: 'image', surface: 'direct_message', source: 'my_photos' },
          'first_message_success',
        );
        return;
      }

      if (!pendingImage) return;
      // Re-run compress if staging still preparing, or as a cheap no-op when small.
      const file = await compressChatImageFile(pendingImage);
      const res = await messagesAPI.sendMedia(otherId, file, {
        kind: 'image',
        disappearing,
        maxViews,
      });
      markOwnSendStick();
      commitThreadMessage(res.data);
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

  // ── Media: My Photos attach + device gallery secondary + camera chooser ──
  const handleAttachClick = () => {
    if (uploadingMedia || pendingImage || pendingLibraryPhotos || recording) return;
    setAttachLibraryOpen(true);
  };

  const handleCameraClick = () => {
    if (uploadingMedia || pendingImage || pendingLibraryPhotos || recording) return;
    setCameraChooserOpen(true);
  };

  const handleChoosePicture = () => {
    setCameraChooserOpen(false);
    setSelfieOpen(true);
  };

  const handleChooseVideo = () => {
    setCameraChooserOpen(false);
    setVideoNoteOpen(true);
  };

  const handleSendVideoNote = useCallback(
    async (blob: Blob, durationMs: number) => {
      if (!otherId || uploadingMedia) return;
      setUploadingMedia(true);
      setMediaError('');
      try {
        const file = blob instanceof File ? blob : await videoFileFromRecorderBlob(blob);
        const res = await messagesAPI.sendMedia(otherId, file, {
          kind: 'video',
          durationMs,
        });
        markOwnSendStick();
        commitThreadMessage(res.data);
      } catch (err: any) {
        const code = String(err?.response?.data?.error || '');
        setMediaError(
          /unsupported|not supported|does not match/i.test(code)
            ? 'This video could not be sent. Record again and tap Send.'
            : code || 'Failed to send video',
        );
      } finally {
        setUploadingMedia(false);
      }
    },
    [otherId, uploadingMedia, markOwnSendStick, commitThreadMessage],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stageImageFile(file);
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
        // Base MIME only — keep multipart Content-Type busboy-safe (see mediaMime.ts).
        const audioType = (mr.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
        const blob = new Blob(recordChunksRef.current, { type: audioType });
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
          markOwnSendStick();
          commitThreadMessage(res.data);
        } catch (err: any) {
          setMediaError(err?.response?.data?.error || 'Failed to send voice note');
        } finally {
          setUploadingMedia(false);
        }
      };
      recordStartRef.current = Date.now();
      // Timeslices keep WebM clusters seekable — avoids first-second-only playback on Chrome.
      mr.start(250);
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
  }, [recording, uploadingMedia, otherId, markOwnSendStick, commitThreadMessage]);

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
      if (!current || !otherId || !user || sendingRef.current) return;

      emitTyping(false);
      if (typingTimer.current) clearTimeout(typingTimer.current);

      inputValueRef.current = '';
      setInput('');
      sendingRef.current = true;
      setSending(true);
      setMediaError('');
      // Keep focus for desktop; on mobile avoid forced refocus which fights the keyboard.
      if (!window.matchMedia('(pointer: coarse)').matches) {
        inputRef.current?.focus();
      }

      try {
        const res = await messagesAPI.sendMessage(otherId, current);
        const saved: Message = res.data;
        markOwnSendStick();
        commitThreadMessage(saved);
        trackEventOnce(
          'first_message_success',
          { kind: 'text', surface: 'direct_message' },
          'first_message_success',
        );
      } catch (err: unknown) {
        inputValueRef.current = current;
        setInput(current);
        const data = (err as { response?: { data?: { error?: string; code?: string } } })?.response
          ?.data;
        const code = data?.code;
        const msg = data?.error;
        if (code === 'match_required' || /mutual match/i.test(msg || '')) {
          setMediaError('You need a mutual match before messaging.');
        } else if (code === 'interaction_blocked' || /blocked/i.test(msg || '')) {
          setMediaError('You cannot message this person.');
        } else if (
          (err as { code?: string })?.code === 'ECONNABORTED' ||
          /timeout/i.test(String((err as { message?: string })?.message || ''))
        ) {
          setMediaError('Send timed out — check your connection and try again.');
        } else {
          setMediaError(msg || 'Could not send message. Try again.');
        }
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [otherId, user, emitTyping, markOwnSendStick, commitThreadMessage],
  );

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault?.();
    await sendTextMessage(inputValueRef.current || input);
  };

  /**
   * Fire send on pointerdown (touch/pen) so mobile Chrome keyboard dismiss
   * cannot steal the tap — same failure mode on Android Chrome and iOS.
   * Mouse left-clicks still use the normal click → submit path.
   */
  const handleSendPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    void handleSend(e as unknown as React.FormEvent);
  };

  /**
   * Desktop Enter + Android Gboard quirks: Chrome often reports IME keys as
   * `Unidentified` / keyCode 229, or routes Return through beforeinput
   * `insertLineBreak` without a matching Enter keydown.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend(e);
    }
  };

  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const ne = e.nativeEvent as InputEvent;
    if (ne.inputType !== 'insertLineBreak' && ne.inputType !== 'insertParagraph') return;
    e.preventDefault();
    void handleSend();
  };

  const handleWithdrawMedia = useCallback(async (messageId: string) => {
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
  }, [withdrawingId]);

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
          markOwnSendStick();
          commitThreadMessage(res.data);
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
      data-testid="messaging-root"
      className={
        embedded
          ? 'flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-x-clip'
          : 'fixed inset-0 flex min-w-0 max-w-full flex-col overflow-x-clip'
      }
      style={{
        background: 'var(--bg-primary)',
        // Kill iOS double-tap zoom trap on the thread chrome (pinch still allowed).
        touchAction: 'manipulation',
      }}
    >

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className={`flex-shrink-0 flex min-w-0 max-w-full items-center gap-1 border-b border-[var(--border-default)] px-1.5 sm:gap-1.5 sm:px-4 bg-[color-mix(in_srgb,var(--bg-primary)_94%,transparent)] backdrop-blur-xl overflow-x-clip ${
          embedded ? '' : 'pt-[env(safe-area-inset-top,0px)]'
        }`}
        style={{
          minHeight: embedded
            ? '4rem'
            : 'calc(4rem + env(safe-area-inset-top, 0px))',
          zIndex: 20,
        }}
      >
        <MobileBackButton
          fallback="/conversations"
          onClick={() => navigate('/conversations')}
          showLabel={false}
          className="-ml-0.5"
        />

        {/* Avatar + name block — centered, tappable to open profile */}
        <button
          type="button"
          onClick={() => otherId && navigate(profilePathForUser(otherId, user?.id))}
          aria-label={otherUser ? `Open ${otherUser.name}'s profile` : 'Open profile'}
          className="flex-1 flex items-center gap-3 min-w-0 text-left rounded-xl px-1 py-1 -mx-1 hover:bg-[var(--bg-card)] active:scale-[0.99] transition-all"
          data-testid="chat-header-profile"
        >
          {otherUser ? (
            <>
              <UserAvatar
                name={otherUser.name}
                photoUrl={otherUser.photo_url}
                userId={otherId}
                linkToProfile={false}
                online={otherUser.online}
                size="sm"
              />
              <div className="min-w-0">
                <p
                  className="font-semibold text-sm leading-tight truncate text-[var(--cream)]"
                  style={{ letterSpacing: '0.01em' }}
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
            <p className="font-semibold text-sm text-[var(--cream)]">
              Conversation
            </p>
          )}
        </button>

        <ThemeToggle variant="chat" />

        {FEATURES.videoCalls && (
          <>
            {/* Video call button */}
            <button
              onClick={() => void handleStartVideoCall()}
              aria-label="Start video call"
              className="mr-cta-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150 active:scale-95 sm:h-[42px] sm:w-[42px]"
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
              <VideoIcon className="h-4 w-4 text-white" />
            </button>
          </>
        )}

        {otherId && (
          <>
            <PanicReportButton
              reportedUserId={otherId}
              threadId={
                user?.id
                  ? `dm:${[user.id, otherId].sort().join('_')}`
                  : `dm:${otherId}`
              }
              onNotice={(msg, tone = 'success') => setSafetyNotice({ msg, tone })}
            />
            <ChatSafetyMenu
              peerId={otherId}
              peerName={otherUser?.name ?? 'this user'}
              onNotice={(msg, tone = 'success') => setSafetyNotice({ msg, tone })}
              onBlocked={() => {
                // Land on the unblock list so the action is obvious.
                window.setTimeout(() => navigate('/settings#blocked'), 600);
              }}
            />
          </>
        )}
      </header>

      {safetyNotice && (
        <div
          className="flex-shrink-0 px-4 py-2 text-center text-xs font-medium border-b"
          style={{
            background:
              safetyNotice.tone === 'success' ? 'rgba(143,199,115,0.12)' : 'rgba(139,69,19,0.15)',
            borderColor: 'var(--border-default)',
            color: safetyNotice.tone === 'success' ? '#8FC773' : 'var(--cream)',
          }}
        >
          {safetyNotice.msg}
        </div>
      )}

      {otherId && meetState && (
        <MeetConsentBar
          state={meetState}
          peerName={otherUser?.name ?? 'them'}
          submitting={meetSubmitting}
          onConfirm={handleMeetConfirm}
          onRevoke={handleMeetRevoke}
        />
      )}

      {/* ── Messages area — memoized so composer keystrokes do not redraw bubbles ─ */}
      <ChatThreadScroll
        messages={messages}
        userId={user?.id}
        otherId={otherId}
        otherUser={otherUser}
        isOtherTyping={isOtherTyping}
        withdrawingId={withdrawingId}
        sending={sending}
        historyReady={historyReady}
        loadingOlder={loadingOlder}
        hasMoreOlder={hasMoreOlder}
        messagesScrollRef={messagesScrollRef}
        bottomRef={bottomRef}
        onScroll={handleThreadScroll}
        onOpenImage={openImageViewer}
        onWithdrawMedia={handleWithdrawMedia}
        onSendIcebreaker={sendTextMessage}
      />

      {/* ── Input bar ─────────────────────────────────────────────────────── */}
      <div
        className="relative z-[70] min-w-0 max-w-full flex-shrink-0 overflow-x-clip border-t border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-primary)_94%,transparent)] px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-xl sm:px-4"
        data-testid="chat-composer"
      >
        {mediaError && (
          <div
            className="mb-2 text-[11px] px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(196,131,42,0.12)',
              border: '1px solid rgba(196,131,42,0.35)',
              color: 'var(--cream)',
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
        {(pendingImage && pendingPreviewUrl) ||
        (pendingLibraryPhotos && pendingLibraryPhotos.length > 0) ? (
          <ImageComposer
            previewUrl={
              pendingPreviewUrl ||
              getPhotoUrl(pendingLibraryPhotos![0].photo_url) ||
              pendingLibraryPhotos![0].photo_url
            }
            rule={viewRule}
            customViews={customViews}
            uploading={uploadingMedia}
            preparing={pendingPreparing}
            photoCount={pendingLibraryPhotos?.length ?? 1}
            onRuleChange={setViewRule}
            onCustomViewsChange={setCustomViews}
            onCancel={clearPendingImage}
            onSend={handleSendPendingImage}
          />
        ) : null}

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
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--cream-muted)' }}
            >
              <CloseIcon className="w-4 h-4" />
            </button>
            <div
              className="flex-1 flex items-center gap-2 px-4 py-3 rounded-full"
              style={{ background: 'var(--bg-card)', border: '1px solid rgba(196,131,42,0.4)' }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: '#E5484D', boxShadow: '0 0 8px #E5484D' }}
              />
              <span className="text-xs" style={{ color: 'var(--cream)' }}>
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
          <form onSubmit={handleSend} className="flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleShareLocation}
              disabled={uploadingMedia || sharingLocation || !!pendingImage || !!pendingLibraryPhotos}
              aria-label="Send current location"
              title="Send current location"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-nn-border bg-nn-card text-nn-copper active:scale-95 disabled:opacity-40 sm:h-11 sm:w-11"
            >
              <LocationPinIcon className="h-4 w-4" />
            </button>

            {/* Camera — opens Picture | Video chooser, then live camera */}
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={uploadingMedia || !!pendingImage || !!pendingLibraryPhotos || recording}
              aria-label="Open camera"
              title="Take a picture or video"
              data-testid="chat-camera-button"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-nn-border bg-nn-card text-nn-copper active:scale-95 disabled:opacity-40 sm:h-11 sm:w-11"
            >
              <CameraIcon className="h-4 w-4" />
            </button>

            {/* My Photos attach (device gallery secondary inside sheet) */}
            <button
              type="button"
              onClick={handleAttachClick}
              disabled={uploadingMedia || !!pendingImage || !!pendingLibraryPhotos}
              aria-label="Attach from My Photos"
              title="Attach from My Photos"
              data-testid="chat-attach-button"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-nn-border bg-nn-card text-nn-copper active:scale-95 disabled:opacity-40 sm:h-11 sm:w-11"
            >
              <AttachIcon className="h-4 w-4" />
            </button>

            {/* Text input — min-w-0 so flex siblings cannot shove past the phone edge */}
            <div className="relative min-w-0 flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBeforeInput={handleBeforeInput}
                placeholder="Say something direct."
                autoComplete="off"
                enterKeyHint="send"
                inputMode="text"
                data-testid="chat-text-input"
                // ≥16px: iOS Safari auto-zooms focused inputs under 16px and sticks >1× until pinch-out.
                className="w-full min-w-0 rounded-full px-3 py-2.5 text-[16px] leading-snug transition-all duration-200 focus:outline-none sm:px-5 sm:py-3"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--cream)',
                  caretColor: '#C4832A',
                  fontSize: '16px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(196,131,42,0.5)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,131,42,0.12)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1px solid var(--border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Voice note OR Send — keep Send visible while in-flight so a
                keyboard-dismiss ghost tap cannot land on Mic after input clears
                (Android Chrome + iOS). */}
            {input.trim() || sending ? (
              <button
                type="submit"
                disabled={(!input.trim() && !sending) || sending}
                aria-label="Send message"
                data-testid="chat-send-button"
                onPointerDown={handleSendPointerDown}
                className="mr-cta-gradient min-h-[40px] flex-shrink-0 rounded-full px-3 py-2 text-sm font-bold transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 sm:min-h-[46px] sm:px-5 sm:py-2.5"
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
                data-testid="chat-voice-button"
                className="mr-cta-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#FFF6E6] shadow-[0_2px_12px_rgba(196,131,42,0.4)] active:scale-95 disabled:opacity-40 sm:h-[46px] sm:w-[46px]"
              >
                <MicIcon className="h-4 w-4" />
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
          onClose={closeImageViewer}
        />
      )}

      <CameraCaptureChooser
        open={cameraChooserOpen}
        onClose={() => setCameraChooserOpen(false)}
        onChoosePicture={handleChoosePicture}
        onChooseVideo={handleChooseVideo}
      />

      <ChatAttachLibrarySheet
        open={attachLibraryOpen}
        onClose={() => setAttachLibraryOpen(false)}
        onConfirm={(photos) => {
          setAttachLibraryOpen(false);
          stageLibraryPhotos(photos);
        }}
        onDeviceGallery={() => {
          setAttachLibraryOpen(false);
          fileInputRef.current?.click();
        }}
      />

      <SelfieCaptureModal
        variant="compact"
        open={selfieOpen}
        onClose={() => setSelfieOpen(false)}
        onCapture={stageImageFile}
        onError={setMediaError}
        ariaLabel="Take a picture"
        captureLabel="Capture"
        filePrefix="chat-photo"
      />

      <VideoNoteCaptureModal
        open={videoNoteOpen}
        onClose={() => setVideoNoteOpen(false)}
        onCapture={handleSendVideoNote}
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
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        color: 'var(--cream)',
        borderRadius: showTail ? '18px 18px 18px 4px' : '18px',
      };

  return (
    <div className="relative max-w-full px-4 py-3 text-sm leading-relaxed break-words [overflow-wrap:anywhere]" style={bubbleStyle}>
      <div className="flex min-w-0 items-start gap-2">
        <LocationPinIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
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
        style={{ borderColor: 'var(--border-default)', background: 'rgba(22,163,74,0.12)' }}
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
      className="flex-shrink-0 max-w-full overflow-x-clip border-b px-3 py-3 sm:px-4"
      style={{ borderColor: 'var(--border-default)', background: 'color-mix(in srgb, var(--bg-card) 95%, transparent)' }}
      data-testid="meet-consent-bar"
    >
      <p className="text-xs font-semibold break-words" style={{ color: 'var(--cream)' }}>
        Ready to meet?
      </p>
      <p className="mt-1 text-[11px] leading-relaxed break-words [overflow-wrap:anywhere]" style={{ color: 'var(--cream-muted)' }}>
        Confirm only when you&apos;re happy to arrange a meet-up with {peerName}. Both of you must
        agree before this shows as mutual.
      </p>
      <div className="mt-2 flex min-w-0 max-w-full flex-wrap items-center gap-2">
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
              style={{ color: 'var(--cream-muted)' }}
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
            style={{ background: '#C4832A', color: 'var(--nn-on-copper)' }}
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
    style={{ color: 'var(--cream-muted)' }}
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
  preparing?: boolean;
  photoCount?: number;
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
  preparing = false,
  photoCount = 1,
  onRuleChange,
  onCustomViewsChange,
  onCancel,
  onSend,
}) => {
  const busy = uploading || preparing;
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
      className="mb-3 max-w-full overflow-x-clip rounded-2xl p-3"
      data-testid="image-composer"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="flex min-w-0 gap-3">
        <img
          src={previewUrl}
          alt="Selected photo preview"
          data-testid="image-composer-preview"
          className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
          style={{ border: '1px solid var(--border-default)' }}
        />
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--cream)' }}>
            {photoCount > 1 ? `${photoCount} photos` : 'Photo'} ·{' '}
            <span data-testid="image-composer-rule">{VIEW_RULE_LABELS[rule]}</span>
          </p>
          <div className="flex max-w-full flex-wrap gap-1.5">
            {rules.map((r) => {
              const active = r === rule;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRuleChange(r)}
                  data-testid={`rule-${r}`}
                  aria-pressed={active}
                  className="rounded-full px-2.5 py-1 text-[11px] transition-all active:scale-95"
                  style={{
                    background: active ? 'rgba(196,131,42,0.22)' : 'var(--bg-primary)',
                    border: `1px solid ${active ? '#C4832A' : 'var(--border-default)'}`,
                    color: active ? 'var(--cream)' : '#A89070',
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
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', color: '#C4832A' }}
              >
                −
              </button>
              <span className="text-xs tabular-nums" style={{ color: 'var(--cream)' }}>
                {customViews} views
              </span>
              <button
                type="button"
                aria-label="More views"
                onClick={() => onCustomViewsChange(Math.min(20, customViews + 1))}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', color: '#C4832A' }}
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
          disabled={busy}
          data-testid="image-composer-cancel"
          className="text-xs px-4 py-2 rounded-full disabled:opacity-40"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', color: 'var(--cream-muted)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={busy}
          data-testid="image-composer-send"
          className="text-xs font-semibold px-5 py-2 rounded-full disabled:opacity-50 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #C4832A, #A45E18)',
            color: '#FFF5E6',
            boxShadow: '0 2px 12px rgba(196,131,42,0.4)',
          }}
        >
          {preparing ? 'Preparing…' : uploading ? 'Sending…' : 'Send'}
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
      <div className="flex max-w-full flex-col items-end gap-1">
        <div
          className="flex max-w-full items-center gap-2 px-4 py-3 text-xs break-words [overflow-wrap:anywhere]"
          data-testid="media-withdrawn"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            color: 'var(--cream-muted)',
            borderRadius: radius,
          }}
        >
          <FlameIcon className="h-4 w-4 shrink-0" />
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
        className="flex max-w-full items-center gap-2 px-4 py-3 text-xs"
        data-testid="image-unavailable"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          color: 'var(--cream-muted)',
          borderRadius: radius,
        }}
      >
        <FlameIcon className="h-4 w-4 shrink-0" />
        <span>Photo no longer available</span>
      </div>
    );
  }

  // Permanent image → inline, always available.
  if (!isDisappearing) {
    if (!url) {
      // Socket payloads can arrive before a signed URL is usable; never paint
      // an empty hole — show the caption/fallback until refetch fills media_url.
      return (
        <div
          className="max-w-full px-4 py-3 text-sm break-words [overflow-wrap:anywhere]"
          data-testid="image-pending"
          style={{
            background: isMine
              ? 'linear-gradient(135deg, #C4832A, #A45E18)'
              : 'var(--bg-card)',
            color: isMine ? '#FFF5E6' : 'var(--cream)',
            border: isMine ? 'none' : '1px solid var(--border-default)',
            borderRadius: radius,
          }}
        >
          {msg.message || '📷 Photo'}
        </div>
      );
    }
    const blurred = shouldBlurMedia(msg.media_clear);
    return (
      <div className="flex w-full max-w-full flex-col items-end gap-1">
        <button
          type="button"
          className="relative w-full max-w-full overflow-hidden cursor-zoom-in text-left"
          data-testid="image-permanent"
          aria-label="Open photo"
          onClick={() => onOpen(msg)}
          style={{
            background: 'var(--bg-card)',
            border: isMine ? 'none' : '1px solid var(--border-default)',
            borderRadius: radius,
            boxShadow: isMine ? '0 2px 12px rgba(196,131,42,0.28)' : 'none',
            padding: 0,
          }}
        >
          <SoftBlurMedia blurred={blurred}>
            <img
              src={url}
              alt={msg.message || 'photo'}
              className="block h-auto w-full max-h-[340px] object-cover pointer-events-none"
              draggable={false}
            />
          </SoftBlurMedia>
        </button>
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
      <div className="flex max-w-full flex-col items-end gap-1">
        <div
          className="flex max-w-full items-center gap-3 px-4 py-3 text-xs"
          data-testid="image-sent-status"
          style={{
            background: 'linear-gradient(135deg, #C4832A, #A45E18)',
            color: '#FFF5E6',
            borderRadius: radius,
            boxShadow: '0 2px 12px rgba(196,131,42,0.28)',
          }}
        >
          <FlameIcon className="h-4 w-4 shrink-0" />
          <div className="flex min-w-0 flex-col">
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
      className="relative aspect-square w-full max-w-[220px] overflow-hidden flex items-center justify-center active:scale-[0.98] transition-transform"
      style={{
        background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-primary) 100%)',
        border: '1px solid var(--border-default)',
        borderRadius: radius,
      }}
      aria-label={`Tap to view photo (${remainingLabel})`}
    >
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'rgba(196,131,42,0.15)', border: '1px solid rgba(196,131,42,0.4)' }}
        >
          <FlameIcon className="h-5 w-5" style={{ color: '#C4832A' }} />
        </div>
        <p className="text-xs font-semibold" style={{ color: 'var(--cream)' }}>
          Tap to view
        </p>
        <p className="text-[10px]" style={{ color: 'var(--cream-muted)' }} data-testid="image-remaining">
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
// Back / Close (and Android system Back) always return to the same 1:1 thread.

const VIEW_WINDOW_MS = 10_000;
const CHAT_IMAGE_OVERLAY_ID = 'chat-image-viewer';

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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const releaseOverlayRef = useRef<((opts?: { popEntry?: boolean }) => void) | null>(null);
  const baseUrl = getPhotoUrl(msg.media_url || undefined);
  const url =
    baseUrl && imgAttempt > 0
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}_retry=${imgAttempt}`
      : baseUrl;

  const closeViewer = useCallback((fromUi: boolean) => {
    releaseOverlayRef.current?.({ popEntry: fromUi });
    releaseOverlayRef.current = null;
    onCloseRef.current();
  }, []);

  // Trap browser / Android Back so it closes the viewer instead of leaving chat.
  // Strict Mode remount-safe: cleanup does not history.back().
  useEffect(() => {
    const release = armOverlayBack(CHAT_IMAGE_OVERLAY_ID, () => {
      releaseOverlayRef.current = null;
      onCloseRef.current();
    });
    releaseOverlayRef.current = release;
    return () => {
      release();
      if (releaseOverlayRef.current === release) {
        releaseOverlayRef.current = null;
      }
    };
  }, []);

  // Escape always closes and returns to the thread.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeViewer(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeViewer]);

  // Disappearing images auto-close after the viewing window. Permanent images
  // stay open until the user closes them.
  useEffect(() => {
    if (status !== 'shown' || isPermanent) return;
    setSecondsLeft(Math.round(VIEW_WINDOW_MS / 1000));
    const tick = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    const closer = window.setTimeout(() => closeViewer(true), VIEW_WINDOW_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(closer);
    };
  }, [status, isPermanent, closeViewer]);

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
      className="fixed inset-0 z-[100] flex flex-col"
      data-testid="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      style={{ background: 'rgba(5,3,1,0.96)' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Obvious Back + Close chrome — safe-area aware for notched phones */}
      <div
        className="flex flex-shrink-0 items-center justify-between gap-2 px-2 sm:px-3"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
        }}
        data-testid="image-viewer-chrome"
      >
        <button
          type="button"
          onClick={() => closeViewer(true)}
          aria-label="Back to chat"
          data-testid="image-viewer-back"
          className="inline-flex min-h-[44px] min-w-[44px] items-center gap-0.5 rounded-xl px-2 text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.15)] active:scale-[0.98]"
        >
          <ChevronLeftIcon className="h-6 w-6 shrink-0" />
          <span className="pr-1 text-sm font-bold leading-none">Back</span>
        </button>
        <button
          type="button"
          onClick={() => closeViewer(true)}
          aria-label="Close photo"
          data-testid="image-viewer-close"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-[var(--cream)] transition-colors hover:bg-[rgba(196,131,42,0.15)] active:scale-[0.98]"
          style={{ background: 'rgba(30,21,8,0.9)', border: '1px solid var(--border-default)' }}
        >
          <CloseIcon className="h-5 w-5" />
          <span className="text-sm font-bold leading-none">Close</span>
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        // Tap empty chrome (not the photo) to close — same thread stays mounted.
        onClick={(e) => {
          if (e.target === e.currentTarget) closeViewer(true);
        }}
      >
        {status === 'error' ? (
          <div className="flex flex-col items-center gap-3 px-8 text-center">
            <FlameIcon className="h-8 w-8" style={{ color: '#C4832A' }} />
            <p className="text-sm" style={{ color: 'var(--cream)' }}>
              Couldn’t load this photo.
            </p>
            <p className="text-xs" style={{ color: 'var(--cream-muted)' }}>
              No view was used. Check your connection and try again.
            </p>
            <button
              type="button"
              data-testid="image-viewer-retry"
              onClick={handleRetry}
              className="mt-1 rounded-full px-5 py-2 text-xs font-semibold"
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
              // Standard open frame: every photo (tiny or huge) fits the same
              // phone/desktop box — contain + centered letterbox/pillarbox.
              <div
                data-testid="image-viewer-frame"
                className="flex items-center justify-center overflow-hidden"
                style={{
                  width: CHAT_IMAGE_VIEWER_FRAME.width,
                  height: CHAT_IMAGE_VIEWER_FRAME.height,
                  maxWidth: CHAT_IMAGE_VIEWER_FRAME.maxWidth,
                  maxHeight: CHAT_IMAGE_VIEWER_FRAME.maxHeight,
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: 12,
                }}
              >
                <SoftBlurMedia blurred={shouldBlurMedia(msg.media_clear)} className="h-full w-full">
                  <img
                    key={imgAttempt}
                    src={url}
                    alt={msg.message || 'photo'}
                    data-testid="image-viewer-img"
                    draggable={false}
                    onLoad={handleLoad}
                    onError={handleError}
                    className="h-full w-full select-none object-contain"
                    style={{ opacity: status === 'shown' ? 1 : 0 }}
                  />
                </SoftBlurMedia>
              </div>
            )}
            {/* Captions under the photo — high contrast for phone distance (Al 5 Sep). */}
            {status === 'shown' && (
              <div
                className="mt-3 flex w-full max-w-[min(90vw,720px)] flex-col items-center gap-2.5 px-2"
                data-testid="image-viewer-meta"
              >
                {!isPermanent && (
                  <span
                    className="rounded-full px-4 py-2.5 text-base font-semibold leading-snug tabular-nums"
                    data-testid="image-viewer-status"
                    style={{
                      background: 'rgba(5,3,1,0.94)',
                      border: '1px solid rgba(196,131,42,0.65)',
                      color: '#FFF5E6',
                      textShadow: '0 1px 2px rgba(0,0,0,0.75)',
                    }}
                  >
                    {remainingViewsLabel(meta.remaining, meta.max)} · closes in {secondsLeft}s
                  </span>
                )}
                <span
                  className="max-w-[22rem] rounded-xl px-4 py-2.5 text-center text-base font-semibold leading-snug"
                  data-testid="image-viewer-trust"
                  style={{
                    background: 'rgba(5,3,1,0.94)',
                    border: '1px solid rgba(240,224,192,0.28)',
                    color: '#FFF5E6',
                    textShadow: '0 1px 2px rgba(0,0,0,0.75)',
                  }}
                >
                  Screenshots can’t be fully blocked on the web. View with trust.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── AudioBubble ──────────────────────────────────────────────────────────────
// Inline voice-note player. Fetches media into a blob URL so Chrome doesn't
// stall after the first cluster on signed streaming URLs.

const VOICE_PAUSE_EVENT = 'menrush:voice-pause';

interface AudioBubbleProps {
  msg: Message;
  isMine: boolean;
  showTail: boolean;
  onWithdraw?: () => void;
  withdrawing?: boolean;
}

const AudioBubble: React.FC<AudioBubbleProps> = ({ msg, isMine, showTail, onWithdraw, withdrawing }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const remoteUrl = getPhotoUrl(msg.media_url || undefined);
  const duration = msg.audio_duration_ms ?? 0;
  const withdrawn = isWithdrawnMedia(msg);

  useEffect(() => {
    if (withdrawn || !remoteUrl) {
      setReadySrc(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(remoteUrl, { signal: controller.signal, credentials: 'omit' });
        if (!res.ok) throw new Error('fetch_failed');
        const blob = await res.blob();
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objectUrl;
        setReadySrc(objectUrl);
      } catch {
        if (!cancelled) {
          // Fallback: stream directly (may still hit the short-play bug on some devices).
          setReadySrc(remoteUrl);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [remoteUrl, withdrawn]);

  useEffect(() => {
    if (withdrawn) return;
    const el = audioRef.current;
    if (!el || !readySrc) return;
    const onTime = () => setPosition(el.currentTime * 1000);
    const onEnded = () => {
      setPlaying(false);
      setPosition(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onForeignPause = (ev: Event) => {
      const detail = (ev as CustomEvent<{ except?: HTMLAudioElement }>).detail;
      if (detail?.except === el) return;
      el.pause();
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlay);
    window.addEventListener(VOICE_PAUSE_EVENT, onForeignPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('play', onPlay);
      window.removeEventListener(VOICE_PAUSE_EVENT, onForeignPause);
    };
  }, [readySrc, withdrawn]);

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
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--cream-muted)',
          borderRadius: radius,
        }}
      >
        {msg.message || 'Voice note withdrawn'}
      </div>
    );
  }

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el || !readySrc) return;
    if (!el.paused) {
      el.pause();
      setPlaying(false);
      return;
    }
    window.dispatchEvent(new CustomEvent(VOICE_PAUSE_EVENT, { detail: { except: el } }));
    try {
      if (el.ended || el.currentTime > 0 && el.readyState < 2) {
        el.currentTime = 0;
      }
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className={`flex max-w-full flex-col ${isMine ? 'items-end' : 'items-start'} gap-1`}>
      <div
        className="flex w-full min-w-0 max-w-full items-center gap-3 px-3 py-2.5"
        style={{
          background: isMine ? 'linear-gradient(135deg, #C4832A, #A45E18)' : 'var(--bg-elevated)',
          border: isMine ? 'none' : '1px solid var(--border-default)',
          color: isMine ? '#FFF5E6' : 'var(--cream)',
          borderRadius: radius,
          boxShadow: isMine ? '0 2px 12px rgba(196,131,42,0.28)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={() => void togglePlay()}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full active:scale-95"
          style={{
            background: isMine ? 'rgba(13,10,6,0.35)' : 'rgba(196,131,42,0.18)',
            color: isMine ? '#FFF5E6' : 'var(--copper)',
          }}
        >
          {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{ background: isMine ? 'rgba(13,10,6,0.35)' : 'rgba(196,131,42,0.18)' }}
          >
            <div
              className="h-full"
              style={{
                width: `${progressPct}%`,
                background: isMine ? '#FFF5E6' : 'var(--copper)',
                transition: 'width 120ms linear',
              }}
            />
          </div>
          <span
            className="text-[10px] tabular-nums"
            style={{ color: isMine ? 'rgba(255,245,230,0.75)' : 'var(--cream-muted)' }}
          >
            {formatDuration(playing ? position : duration)}
          </span>
        </div>
        {readySrc && (
          <audio ref={audioRef} src={readySrc} preload="auto" playsInline />
        )}
      </div>
      {onWithdraw && isMine && (
        <WithdrawMediaButton onClick={onWithdraw} loading={withdrawing} />
      )}
    </div>
  );
};

// ── VideoBubble ──────────────────────────────────────────────────────────────
// Progressive stream with a locked play src. Open-thread polls re-sign media
// URLs every ~2.5s; binding src to that rotating grant restarted the download
// forever (black frame, duration `--:--`). We refresh the grant once on open /
// retry, wait for loadedmetadata, and surface an honest tap-to-retry on failure.

interface VideoBubbleProps {
  msg: Message;
  isMine: boolean;
  showTail: boolean;
  onWithdraw?: () => void;
  withdrawing?: boolean;
}

const VideoBubble: React.FC<VideoBubbleProps> = ({ msg, isMine, showTail, onWithdraw, withdrawing }) => {
  const propUrl = getPhotoUrl(msg.media_url || undefined);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loadGenRef = useRef(0);
  const [loadState, setLoadState] = useState<ChatVideoLoadState>('idle');
  const [playSrc, setPlaySrc] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const withdrawn = isWithdrawnMedia(msg);
  const radius = showTail
    ? isMine
      ? '18px 18px 4px 18px'
      : '18px 18px 18px 4px'
    : '18px';

  useEffect(() => {
    return () => {
      loadGenRef.current += 1;
    };
  }, []);

  // Wait for metadata (or timeout / error) once a play src is locked in.
  // Keep error listeners through `ready` so a mid-play void surfaces retry UI
  // instead of a forever-black native player with duration `--:--`.
  useEffect(() => {
    if ((loadState !== 'loading' && loadState !== 'ready') || !playSrc) return;
    const el = videoRef.current;
    if (!el) return;

    const gen = loadGenRef.current;
    let settled = loadState === 'ready';

    const succeed = () => {
      if (settled || gen !== loadGenRef.current) return;
      settled = true;
      setLoadState('ready');
      void el.play().catch(() => undefined);
    };

    const fail = (hint: string) => {
      if (gen !== loadGenRef.current) return;
      settled = true;
      setPlaySrc(null);
      setErrorHint(hint);
      setLoadState('error');
    };

    const onMeta = () => {
      if (loadState === 'loading') succeed();
    };
    const onCanPlay = () => {
      if (loadState === 'loading') succeed();
    };
    const onError = () => fail('Download failed. Tap to try again');

    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('error', onError);

    let timer: number | undefined;
    if (loadState === 'loading') {
      timer = window.setTimeout(
        () => fail('Still downloading. Tap to try again'),
        VIDEO_LOAD_TIMEOUT_MS,
      );
      // Cached / already-buffered
      if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        succeed();
      }
    }

    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('error', onError);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [loadState, playSrc]);

  if (withdrawn) {
    return (
      <div
        className="px-4 py-3 text-xs"
        data-testid="media-withdrawn"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--cream-muted)',
          borderRadius: radius,
        }}
      >
        {msg.message || 'Video withdrawn'}
      </div>
    );
  }

  const blurred = shouldBlurMedia(msg.media_clear);

  const beginLoad = () => {
    if (blurred) return;
    const gen = ++loadGenRef.current;
    setLoadState('loading');
    setErrorHint(null);
    setPlaySrc(null);

    void (async () => {
      let resolved = propUrl;
      let mime: string | undefined;

      if (msg.id) {
        try {
          const res = await messagesAPI.getMediaUrl(msg.id);
          if (gen !== loadGenRef.current) return;
          const fresh = getPhotoUrl(res.data.url);
          if (fresh) resolved = fresh;
          mime = res.data.mime_type;
        } catch {
          // Fall through to the thread's signed URL if refresh fails.
        }
      }

      if (gen !== loadGenRef.current) return;

      const unsupported = chatVideoUnsupportedHint(mime);
      if (unsupported) {
        setErrorHint(unsupported);
        setLoadState('error');
        return;
      }

      if (!resolved) {
        setErrorHint('Video unavailable');
        setLoadState('error');
        return;
      }

      // Lock src — ignore later poll re-grants until the user retries.
      setPlaySrc(resolved);
    })();
  };

  const showPlayer = (loadState === 'loading' || loadState === 'ready') && !!playSrc;
  const showOverlay =
    loadState === 'idle' || loadState === 'loading' || loadState === 'error' || blurred;

  return (
    <div className={`flex max-w-full flex-col ${isMine ? 'items-end' : 'items-start'} gap-1`}>
      <div
        className="relative w-full max-w-full overflow-hidden"
        style={{
          borderRadius: radius,
          border: isMine ? 'none' : '1px solid var(--border-default)',
          background: 'var(--bg-elevated)',
        }}
      >
        {propUrl || showPlayer ? (
          <SoftBlurMedia blurred={blurred} data-testid="video-bubble">
            <div className="relative w-full bg-black">
              {showPlayer ? (
                <video
                  ref={videoRef}
                  key={playSrc}
                  src={playSrc || undefined}
                  controls={loadState === 'ready' && !blurred}
                  playsInline
                  {...{ 'webkit-playsinline': 'true' }}
                  // metadata + Accept-Ranges lets Safari paint/play before full file.
                  preload="metadata"
                  className="block h-auto min-h-[180px] max-h-[320px] w-full bg-black"
                  data-testid="video-bubble-player"
                  data-load-state={loadState}
                />
              ) : (
                <div className="h-[180px] w-full bg-black/90" aria-hidden />
              )}

              {showOverlay && !blurred ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-3">
                  {loadState === 'loading' ? (
                    <div
                      className="flex flex-col items-center gap-2 text-[#F0E0C0]"
                      data-testid="video-bubble-loading"
                      role="status"
                      aria-live="polite"
                    >
                      <PulseRing size={44} />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--cream-muted)]">
                        Loading…
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={beginLoad}
                      data-testid={loadState === 'error' ? 'video-bubble-retry' : 'video-bubble-open'}
                      className="flex flex-col items-center justify-center gap-2 text-[#F0E0C0]"
                      aria-label={loadState === 'error' ? 'Retry video' : 'Open video'}
                    >
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C4832A] text-lg font-extrabold text-[#1A0E03]"
                        aria-hidden
                      >
                        {loadState === 'error' ? '↻' : '▶'}
                      </span>
                      <span className="text-center text-[11px] font-bold uppercase tracking-wide text-[var(--cream-muted)]">
                        {loadState === 'error' ? 'Tap to try again' : 'Tap to open'}
                      </span>
                      {loadState === 'error' && errorHint ? (
                        <span className="max-w-[16rem] text-center text-[10px] font-medium normal-case tracking-normal text-[#F0E0C0]/90">
                          {errorHint}
                        </span>
                      ) : null}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </SoftBlurMedia>
        ) : (
          <div className="px-4 py-6 text-xs text-[var(--cream-muted)]">Video unavailable</div>
        )}
        {msg.audio_duration_ms ? (
          <p className="px-2 py-1 text-[10px] tabular-nums text-[var(--cream-muted)]">
            {formatDuration(msg.audio_duration_ms)}
          </p>
        ) : null}
      </div>
      {onWithdraw && isMine && (
        <WithdrawMediaButton onClick={onWithdraw} loading={withdrawing} />
      )}
    </div>
  );
};

/**
 * Isolated message list — keeps typing/composer state from re-rendering every bubble.
 *
 * PERF next pass: virtualize with @tanstack/react-virtual when threads regularly
 * exceed ~80 messages on phone; preserve date separators + media bubbles + scroll restore.
 */
interface ChatThreadScrollProps {
  messages: Message[];
  userId?: string;
  otherId?: string;
  otherUser: OtherUser | null;
  isOtherTyping: boolean;
  withdrawingId: string | null;
  sending: boolean;
  historyReady: boolean;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  messagesScrollRef: React.RefObject<HTMLDivElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onOpenImage: (msg: Message) => void;
  onWithdrawMedia: (id: string) => void | Promise<void>;
  onSendIcebreaker: (text: string) => void | Promise<void>;
}

const ChatThreadScroll = memo(function ChatThreadScroll({
  messages,
  userId,
  otherId,
  otherUser,
  isOtherTyping,
  withdrawingId,
  sending,
  historyReady,
  loadingOlder,
  hasMoreOlder,
  messagesScrollRef,
  bottomRef,
  onScroll,
  onOpenImage,
  onWithdrawMedia,
  onSendIcebreaker,
}: ChatThreadScrollProps) {
  return (
      <div
        ref={messagesScrollRef}
        onScroll={onScroll}
        className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-clip overflow-y-auto px-3 py-4 sm:px-4 [content-visibility:auto] [overflow-anchor:none]"
        style={{ scrollbarWidth: 'thin' }}
        data-testid="chat-messages-scroll"
        data-messaging-thread="1"
        data-stick-policy="near-bottom-or-own-send"
      >
        {(loadingOlder || hasMoreOlder) && messages.length > 0 && (
          <div
            className="mb-3 flex justify-center"
            data-testid="chat-load-older"
            aria-hidden={!loadingOlder}
          >
            <span className="text-[10px] font-medium text-[var(--cream-muted)]">
              {loadingOlder ? 'Loading earlier…' : hasMoreOlder ? 'Scroll for earlier' : ''}
            </span>
          </div>
        )}
        {messages.length === 0 &&
          !sending &&
          (!historyReady || threadLikelyHasHistory(otherId)) && (
          <div
            className="flex flex-col gap-3 pt-2"
            data-testid="chat-history-loading"
            aria-busy="true"
            aria-label="Loading conversation"
          >
            {[0.92, 0.7, 0.84].map((width, i) => (
              <div
                key={i}
                className={`h-11 animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] ${
                  i % 2 === 0 ? 'self-start' : 'self-end'
                }`}
                style={{ width: `${Math.round(width * 100)}%`, maxWidth: 280 }}
              />
            ))}
          </div>
        )}

        {messages.length === 0 &&
          !sending &&
          historyReady &&
          !threadLikelyHasHistory(otherId) && (
          <div
            className="flex flex-col items-center justify-center h-full select-none px-4"
            data-testid="chat-icebreakers"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
              <BubbleIcon className="w-8 h-8" style={{ color: 'var(--copper)', opacity: 0.5 }} />
            </div>
            <p className="font-medium text-sm text-[var(--cream-muted)]">
              No messages yet
            </p>
            <p className="text-xs mt-1 mb-4 text-center text-[var(--cream-muted)]">
              Be direct. Consent first.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {ICEBREAKERS.map((line) => (
                <button
                  key={line}
                  type="button"
                  disabled={sending}
                  onClick={() => void onSendIcebreaker(line)}
                  className="rounded-2xl border border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.1)] px-4 py-3 text-left text-[13px] font-medium text-[var(--cream)] transition-colors hover:bg-[rgba(196,131,42,0.2)] disabled:opacity-50"
                >
                  {line}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.sender_id === userId;
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
                    <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
                    <span
                      className="text-[10px] font-semibold px-3 py-1 rounded-full"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--cream-muted)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {formatDateLabel(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
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
                  <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
                  <span
                    className="text-[10px] font-semibold px-3 py-1 rounded-full"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--cream-muted)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {formatDateLabel(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
                </div>
              )}

              {/* Message row — min-w-0 so long/media bubbles cannot widen the phone viewport */}
              <div
                className={`flex min-w-0 max-w-full [content-visibility:auto] [contain-intrinsic-size:auto_72px] ${isMine ? 'justify-end' : 'justify-start'} ${
                  isGrouped ? 'mt-0.5' : 'mt-3'
                }`}
              >
                {/* Received: avatar placeholder for spacing */}
                {!isMine && (
                  <div className="mr-2 mb-1 flex w-7 flex-shrink-0 items-end">
                    {showTail && otherId ? (
                      <ProfilePhotoLink
                        userId={otherId}
                        name={otherUser?.name}
                        className="block"
                        data-testid={`chat-bubble-avatar-${otherId}`}
                      >
                        {otherUser?.photo_url ? (
                          <div
                            className="h-7 w-7 overflow-hidden rounded-full"
                            style={{ border: '1px solid var(--border-default)', flexShrink: 0 }}
                          >
                            <img
                              src={otherUser.photo_url}
                              alt={otherUser.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <SilhouetteAvatar size={28} variant="chat" />
                        )}
                      </ProfilePhotoLink>
                    ) : null}
                  </div>
                )}

                <div
                  className={`flex min-w-0 max-w-[min(78%,20rem)] flex-col overflow-hidden ${
                    isMine ? 'items-end' : 'items-start'
                  }`}
                >
                  {msg.media_type === 'image' ? (
                    <ImageBubble
                      msg={msg}
                      isMine={isMine}
                      showTail={showTail}
                      onOpen={onOpenImage}
                      onWithdraw={
                        canWithdrawMedia(msg, userId)
                          ? () => msg.id && void onWithdrawMedia(msg.id)
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
                        canWithdrawMedia(msg, userId)
                          ? () => msg.id && void onWithdrawMedia(msg.id)
                          : undefined
                      }
                      withdrawing={withdrawingId === msg.id}
                    />
                  ) : msg.media_type === 'video' ? (
                    <VideoBubble
                      msg={msg}
                      isMine={isMine}
                      showTail={showTail}
                      onWithdraw={
                        canWithdrawMedia(msg, userId)
                          ? () => msg.id && void onWithdrawMedia(msg.id)
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
                      className="relative max-w-full break-words px-4 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]"
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
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--cream)',
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
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
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

  );
});
