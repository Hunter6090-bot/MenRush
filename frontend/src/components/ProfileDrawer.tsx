import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NearbyUser } from "./ProfileCard";
import { FadedBrandFace } from "./FadedBrandFace";
import { PulsingAvatar } from "./PulsingAvatar";
import { useResolvingPhotoSrc } from "./UserAvatar";
import { ProfilePhotoViewer } from "./ProfilePhotoViewer";
import { IconPulse, IconClose, IconMatches, IconChat, IconUnmatch } from "./icons";
import { VerifiedBadge } from "./VerifiedBadge";
import { ChatSafetyMenu } from "./ChatSafetyMenu";
import { getDistanceLabel, isUserPulsing } from "../lib/discovery";
import { profilePathForUser } from "../lib/profileLinks";
import {
  matchCtaAriaLabel,
  matchCtaDisabled,
  matchCtaToneClasses,
  matchInterestState,
} from "../lib/matchCta";
import { useAuthStore } from "../hooks/store";
import { useIsDesktopLayout } from "../hooks/useMediaQuery";

type SheetSnap = "half" | "tall" | "full";

const SNAP_VH: Record<SheetSnap, number> = {
  half: 42,
  tall: 56,
  full: 92,
};

interface ProfileDrawerProps {
  user: NearbyUser | null;
  liked: boolean;
  /** Mutual match — only then is Open chat valid (messaging requires mutual). */
  mutual?: boolean;
  onClose: () => void;
  onLike: () => Promise<void> | void;
  onUnmatch?: () => Promise<void> | void;
  onPass?: () => void;
  onMessage: () => void;
  onPulseBack?: () => Promise<void> | void;
  /** Safety feedback after report/block (18+ trust & safety). */
  onSafetyNotice?: (message: string, tone?: "success" | "error") => void;
  onBlocked?: () => void;
}

function nearestSnap(vh: number): SheetSnap {
  const entries = Object.entries(SNAP_VH) as [SheetSnap, number][];
  let best: SheetSnap = "tall";
  let bestDist = Infinity;
  for (const [key, value] of entries) {
    const d = Math.abs(value - vh);
    if (d < bestDist) {
      bestDist = d;
      best = key;
    }
  }
  return best;
}

export function ProfileDrawer({
  user,
  liked,
  mutual = false,
  onClose,
  onLike,
  onUnmatch,
  onPass: _unusedPass,
  onMessage,
  onPulseBack,
  onSafetyNotice,
  onBlocked,
}: ProfileDrawerProps) {
  const navigate = useNavigate();
  const authUserId = useAuthStore((s) => s.user?.id);
  const isDesktop = useIsDesktopLayout();
  const [mounted, setMounted] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("tall");
  const [dragVh, setDragVh] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const dragRef = useRef<{ startY: number; startVh: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const safetyMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) {
      setMounted(false);
      setSnap("tall");
      setDragVh(null);
      setMoreOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (moreOpen) setMoreOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, onClose, moreOpen]);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isDesktop) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = { startY: e.clientY, startVh: dragVh ?? SNAP_VH[snap] };
    },
    [dragVh, isDesktop, snap],
  );

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const deltaY = dragRef.current.startY - e.clientY;
    const next = Math.min(96, Math.max(28, dragRef.current.startVh + (deltaY / window.innerHeight) * 100));
    setDragVh(next);
  }, []);

  const endDrag = useCallback(() => {
    if (dragVh == null) {
      dragRef.current = null;
      return;
    }
    if (dragVh < 30) {
      onClose();
      dragRef.current = null;
      setDragVh(null);
      return;
    }
    const next = nearestSnap(dragVh);
    setSnap(next);
    setDragVh(null);
    dragRef.current = null;
  }, [dragVh, onClose]);

  const hasPhoto = Boolean(user?.photo_url?.trim());
  const hasCover = Boolean(user?.cover_url?.trim());
  const photoResolved = useResolvingPhotoSrc(hasPhoto ? user?.photo_url : undefined, user?.age);
  const coverResolved = useResolvingPhotoSrc(hasCover ? user?.cover_url : undefined);
  const photo = hasPhoto ? photoResolved.src : undefined;
  const cover = hasCover ? coverResolved.src : undefined;
  const onPhotoError = photoResolved.onError;
  const onCoverError = coverResolved.onError;
  const [viewer, setViewer] = useState<{ src: string; alt: string } | null>(null);

  if (!user) return null;

  const parsedDistance =
    user.distance_km != null && user.distance_km !== ""
      ? parseFloat(String(user.distance_km))
      : user.distance_label != null && user.distance_label.trim() !== ""
        ? parseFloat(user.distance_label.replace(/[^0-9.]/g, ""))
        : null;
  const distance = Number.isFinite(parsedDistance) ? parsedDistance : null;
  const distLabel =
    distance != null
      ? getDistanceLabel({ ...user, distance_km: distance })
      : user.distance_label != null && user.distance_label.trim() !== ""
        ? user.distance_label
        : null;
  const isPulsing = isUserPulsing(user);
  const matchState = matchInterestState({ liked, mutual });
  const matchDisabled = matchCtaDisabled(matchState);
  const currentVh = dragVh ?? SNAP_VH[snap];
  const dragging = dragVh != null;
  const heroEnlargeSrc = cover || photo || null;
  const avatarEnlargeSrc = photo || null;
  const ageDist = [user.age, distLabel].filter(Boolean).join(" · ");

  const openAlbum = () => {
    onClose();
    navigate(profilePathForUser(user.id, authUserId) + "#albums");
  };

  const openProfile = () => {
    onClose();
    navigate(profilePathForUser(user.id, authUserId));
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-stretch sm:justify-end"
      data-testid="profile-drawer"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close profile sheet"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        data-testid="pin-sheet"
        className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-[var(--border-default)] bg-[#1E1508] shadow-2xl sm:h-full sm:max-w-[420px] sm:rounded-none sm:border-l
        "
        style={{
          height: isDesktop ? "100%" : `${currentVh}vh`,
          maxHeight: isDesktop ? "none" : `${currentVh}vh`,
          transform: mounted
            ? "translate3d(0,0,0)"
            : isDesktop
              ? "translate3d(100%,0,0)"
              : "translate3d(0,100%,0)",
          transition: dragging
            ? "none"
            : "transform 280ms cubic-bezier(0.22,1,0.36,1), height 220ms cubic-bezier(0.22,1,0.36,1), max-height 220ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          role="slider"
          aria-label="Resize profile sheet"
          aria-valuemin={SNAP_VH.half}
          aria-valuemax={SNAP_VH.full}
          aria-valuenow={Math.round(currentVh)}
          tabIndex={0}
          data-testid="profile-sheet-handle"
          className="sm:hidden shrink-0 flex cursor-grab touch-none flex-col items-center pb-1 pt-2 active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="h-1.5 w-11 rounded-full bg-[var(--border-strong)]" />
        </div>

        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={onClose}
            className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] border border-[var(--border-default)] text-[var(--cream)] flex items-center justify-center"
            aria-label="Close"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Compact pin-sheet body — design state 3 */}
        <div className="relative z-10 flex shrink-0 gap-3 px-4 pb-2 pt-1" data-testid="profile-sheet-hero">
          <div
            className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-elevated)]"
            data-testid={`drawer-avatar-${user.id}`}
          >
            {avatarEnlargeSrc || heroEnlargeSrc ? (
              <button
                type="button"
                data-testid="drawer-cover-enlarge"
                aria-label={`Enlarge ${user.name}'s photo`}
                className="absolute inset-0 block h-full w-full cursor-zoom-in p-0 border-0"
                onClick={() =>
                  setViewer({
                    src: (avatarEnlargeSrc || heroEnlargeSrc)!,
                    alt: user.name,
                  })
                }
              >
                <img
                  src={(avatarEnlargeSrc || heroEnlargeSrc)!}
                  alt=""
                  className="h-full w-full object-cover object-top"
                  onError={avatarEnlargeSrc ? onPhotoError : onCoverError}
                />
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center" data-testid={`drawer-hero-placeholder-${user.id}`}>
                <PulsingAvatar isPulsing={isPulsing} size={112} intensity="subtle">
                  <FadedBrandFace variant="profile" size={112} label={user.name} />
                </PulsingAvatar>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate font-display text-xl font-extrabold uppercase tracking-wide text-[#F0E0C0]">
                {user.name}
              </h2>
              {(user as { is_verified?: boolean }).is_verified ? <VerifiedBadge /> : null}
            </div>
            {ageDist ? (
              <p className="mt-1 text-[14px] font-semibold text-[var(--cream-soft)]">{ageDist}</p>
            ) : user.age ? (
              <p className="mt-1 text-[14px] font-semibold text-[var(--cream-soft)]">{user.age}</p>
            ) : null}
            {isPulsing ? (
              <p className="mt-1 text-[13px] font-bold text-[#C4832A]">Pulse</p>
            ) : user.online ? (
              <p className="mt-1 text-[13px] font-bold text-[#4ADE80]" data-testid="pin-sheet-now">
                Now
              </p>
            ) : (
              <p className="mt-1 text-[13px] font-medium text-[var(--cream-muted)]">Offline</p>
            )}
            <button
              type="button"
              onClick={openProfile}
              className="mt-2 min-h-[44px] text-left text-[14px] font-bold text-[var(--copper)]"
              data-testid="pin-sheet-profile-link"
            >
              Profile &gt;
            </button>
            {/* Hidden legacy hooks for tests that still look for looking-for / interests in DOM when present */}
            {user.looking_for ? (
              <div className="sr-only" data-testid="drawer-looking-for">
                {user.looking_for}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto shrink-0 border-t border-[var(--border-default)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onMessage}
              data-testid="drawer-open-chat"
              title="Chat"
              aria-label={`Chat with ${user.name}`}
              className="inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-[var(--copper)]/55 bg-[rgba(196,131,42,0.18)] px-2 text-[12px] font-extrabold text-[var(--copper)]"
            >
              <IconChat size={18} />
              Chat
            </button>
            <button
              type="button"
              onClick={openAlbum}
              data-testid="pin-sheet-album"
              title="Album"
              aria-label={`Album for ${user.name}`}
              className="inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-2 text-[12px] font-extrabold text-[#F0E0C0]"
            >
              <AlbumGlyph />
              Album
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              data-testid="pin-sheet-more"
              title="More"
              aria-label="More"
              className="inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-2 text-[12px] font-extrabold text-[#F0E0C0]"
            >
              <MoreGlyph />
              More
            </button>
          </div>
        </div>
      </div>

      {moreOpen ? (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="More"
          data-testid="pin-sheet-more-menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close more"
            onClick={() => setMoreOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-t-[1.5rem] border border-[var(--border-default)] bg-[#1E1508] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                {avatarEnlargeSrc ? (
                  <img src={avatarEnlargeSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <FadedBrandFace variant="profile" size={40} label={user.name} />
                )}
              </div>
              <p className="truncate text-[16px] font-extrabold text-[#F0E0C0]">{user.name}</p>
            </div>

            {/* Match / Unmatch / Pulse relocated into More */}
            {!mutual ? (
              <button
                type="button"
                disabled={matchDisabled}
                aria-disabled={matchDisabled}
                aria-label={matchCtaAriaLabel(matchState, user.name, { mutualOpensChat: true })}
                title={matchState === "outgoing" ? "Sent" : "Match"}
                onClick={() => {
                  if (matchState === "none") void onLike();
                  setMoreOpen(false);
                }}
                data-testid="drawer-match"
                className={`mb-2 flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-bold ${matchCtaToneClasses(matchState)}`}
              >
                <IconMatches size={18} />
                <span>{matchState === "outgoing" ? "Sent" : "Match"}</span>
              </button>
            ) : onUnmatch ? (
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(
                    `Unmatch with ${user.name}? Chat locks again until you both match.`,
                  );
                  if (confirmed) {
                    void onUnmatch();
                    setMoreOpen(false);
                  }
                }}
                data-testid="drawer-unmatch"
                className="mb-2 flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-[var(--border-default)] px-3 text-left text-[15px] font-bold text-[#F0E0C0]"
              >
                <IconUnmatch size={18} />
                Unmatch
              </button>
            ) : null}

            {onPulseBack && isPulsing ? (
              <button
                type="button"
                onClick={() => {
                  void onPulseBack();
                  setMoreOpen(false);
                }}
                data-testid="pin-sheet-pulse"
                className="mb-2 flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-[var(--copper)]/50 px-3 text-left text-[15px] font-bold text-[var(--copper)]"
              >
                <IconPulse size={16} />
                Pulse back
              </button>
            ) : null}

            {/* Report / Block via existing ChatSafetyMenu — opened programmatically face */}
            <div ref={safetyMenuRef} className="mb-2" data-testid="pin-sheet-safety">
              <ChatSafetyMenu
                peerId={user.id}
                peerName={user.name}
                onNotice={onSafetyNotice}
                onBlocked={() => {
                  onBlocked?.();
                  setMoreOpen(false);
                  onClose();
                }}
              />
            </div>
            <p className="mb-3 px-1 text-[12px] text-[var(--cream-muted)]">
              Use the flag menu above for Report. Block is red in that menu.
            </p>

            <button
              type="button"
              data-testid="pin-sheet-more-cancel"
              onClick={() => setMoreOpen(false)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-full border border-[var(--cream)]/45 text-[15px] font-extrabold text-[#F0E0C0]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {viewer ? (
        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <ProfilePhotoViewer
            src={viewer.src}
            alt={viewer.alt}
            onClose={() => setViewer(null)}
          />
        </div>
      ) : null}
    </div>
  );
}

function AlbumGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path strokeLinecap="round" d="M21 16l-5-5-4 4-2-2-5 5" />
    </svg>
  );
}

function MoreGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" fillRule="evenodd" aria-hidden>
      <circle cx="6" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="18" cy="12" r="1.75" fill="currentColor" />
    </svg>
  );
}
