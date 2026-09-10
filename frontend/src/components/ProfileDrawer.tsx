import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NearbyUser } from "./ProfileCard";
import { SilhouetteAvatar } from "./SilhouetteAvatar";
import { PulsingAvatar } from "./PulsingAvatar";
import { useResolvingPhotoSrc } from "./UserAvatar";
import { ProfilePhotoViewer } from "./ProfilePhotoViewer";
import { IconPulse, IconClose } from "./icons";
import { StatusBadge } from "./StatusBadge";
import { DistancePill } from "./DistancePill";
import { VerifiedBadge } from "./VerifiedBadge";
import { ChatSafetyMenu } from "./ChatSafetyMenu";
import { getDistanceLabel, isUserPulsing } from "../lib/discovery";
import { profilePathForUser } from "../lib/profileLinks";
import {
  matchCtaAriaLabel,
  matchCtaDisabled,
  matchCtaLabel,
  matchCtaToneClasses,
  matchInterestState,
} from "../lib/matchCta";
import { useAuthStore } from "../hooks/store";
import { useIsDesktopLayout } from "../hooks/useMediaQuery";

type SheetSnap = "half" | "tall" | "full";

const SNAP_VH: Record<SheetSnap, number> = {
  half: 52,
  tall: 78,
  full: 94,
};

interface ProfileDrawerProps {
  user: NearbyUser | null;
  liked: boolean;
  /** Mutual match — only then is Open chat valid (messaging requires mutual). */
  mutual?: boolean;
  onClose: () => void;
  onLike: () => Promise<void> | void;
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
  onPass,
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
  const dragRef = useRef<{ startY: number; startVh: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) {
      setMounted(false);
      setSnap("tall");
      setDragVh(null);
      return;
    }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, onClose]);

  const currentVh = dragVh ?? SNAP_VH[snap];

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isDesktop) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startY: e.clientY,
        startVh: currentVh,
      };
    },
    [currentVh, isDesktop],
  );

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = drag.startY - e.clientY; // up = taller
    const next = Math.min(96, Math.max(38, drag.startVh + (dy / window.innerHeight) * 100));
    setDragVh(next);
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const dy = drag.startY - e.clientY;
      const next = Math.min(96, Math.max(38, drag.startVh + (dy / window.innerHeight) * 100));
      // Flick dismiss if dragged far down from half
      if (next < 42 && dy < -40) {
        setDragVh(null);
        onClose();
        return;
      }
      const snapped = nearestSnap(next);
      setSnap(snapped);
      setDragVh(null);
    },
    [onClose],
  );

  const { src: photo, onError: onPhotoError } = useResolvingPhotoSrc(
    user?.photo_url,
    user?.age,
  );
  const { src: cover, onError: onCoverError } = useResolvingPhotoSrc(user?.cover_url);
  const [viewer, setViewer] = useState<{ src: string; alt: string } | null>(null);

  if (!user) return null;

  const distance = parseFloat(String(user.distance_km));
  const distLabel = getDistanceLabel(user);
  const isPulsing = isUserPulsing(user);
  const dragging = dragVh != null;
  const matchState = matchInterestState({ liked, mutual });
  const matchLabel = matchCtaLabel(matchState, user.name);
  const matchDisabled = matchCtaDisabled(matchState);
  const heroEnlargeSrc = cover || photo || null;
  const avatarEnlargeSrc = photo || null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center items-end sm:items-stretch sm:justify-end"
      onClick={onClose}
      style={{
        background: mounted ? "rgba(13,10,6,0.60)" : "rgba(13,10,6,0)",
        transition: "background var(--nn-dur-base) var(--nn-ease-out)",
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="
          relative w-full lg:w-[420px] lg:h-full
          lg:max-h-none
          bg-[var(--bg-elevated)] border border-[var(--border-default)]
          rounded-t-3xl lg:rounded-none lg:rounded-l-2xl
          shadow-[var(--shadow-glow-strong)]
          overflow-hidden flex flex-col
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
        {/* Drag handle — mobile only */}
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
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--cream-muted)]">
            Drag to resize
          </span>
        </div>

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          <div className="rounded-full bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] border border-[var(--border-default)]">
            <ChatSafetyMenu
              peerId={user.id}
              peerName={user.name}
              onNotice={onSafetyNotice}
              onBlocked={() => {
                onBlocked?.();
                onClose();
              }}
            />
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] border border-[var(--border-default)] text-[var(--cream)] hover:border-[var(--copper)]/40 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/*
          Hero + avatar live outside the scrollport so the circular face is never
          clipped by overflow-y (the old -mt-12-inside-scroll pattern bisected
          avatars on phone). Avatar is a full circle in its own row between photo
          and name — no negative-margin hang into overflow-hidden bands.
        */}
        <div className="relative z-10 w-full shrink-0" data-testid="profile-sheet-hero">
          <div
            className="relative w-full overflow-hidden"
            style={{
              height: isDesktop ? 360 : snap === "half" && !dragging ? 200 : 240,
              maxHeight: isDesktop ? "46vh" : "36vh",
              background: "linear-gradient(135deg,var(--bg-elevated),var(--bg-card))",
              transition: dragging ? "none" : "height 220ms ease",
            }}
          >
            {heroEnlargeSrc ? (
              <button
                type="button"
                data-testid="drawer-cover-enlarge"
                aria-label={`Enlarge ${cover ? "cover" : "photo"}`}
                className="absolute inset-0 block h-full w-full cursor-zoom-in p-0 border-0"
                onClick={() =>
                  setViewer({
                    src: heroEnlargeSrc,
                    alt: cover ? `${user.name}'s cover` : user.name,
                  })
                }
              >
                <img
                  src={heroEnlargeSrc}
                  alt=""
                  className={`w-full h-full object-cover ${cover ? "object-center" : "object-top"}`}
                  onError={cover ? onCoverError : onPhotoError}
                />
              </button>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <SilhouetteAvatar size={148} variant="card" />
              </div>
            )}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, var(--bg-elevated) 0%, transparent 38%)",
              }}
            />
            {/* Status + distance in the top band — away from the face mid-frame */}
            <div className="absolute top-3 left-3 z-[1] flex flex-col items-start gap-1.5 max-w-[70%] pointer-events-none">
              {isPulsing ? (
                <StatusBadge online={false} pulsing />
              ) : user.online ? (
                <StatusBadge online lastSeen={user.last_seen} size="xs" />
              ) : null}
              <DistancePill km={distance} label={distLabel} />
            </div>
          </div>

          {/* Full circular avatar — own padded row, never scroll-clipped or mid-cut */}
          <div className="flex items-center px-5 pt-3 pb-1">
            {avatarEnlargeSrc ? (
              <button
                type="button"
                data-testid={`drawer-avatar-${user.id}`}
                aria-label={`Enlarge ${user.name}'s photo`}
                className="inline-flex shrink-0 rounded-full ring-2 ring-[var(--copper)] shadow-[0_4px_14px_rgba(0,0,0,0.4)] cursor-zoom-in p-0 border-0 bg-transparent"
                onClick={() =>
                  setViewer({ src: avatarEnlargeSrc, alt: user.name })
                }
              >
                <PulsingAvatar isPulsing={isPulsing} size={72} intensity="subtle">
                  <div
                    className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg,var(--bg-elevated),var(--bg-card))",
                    }}
                  >
                    <img
                      src={avatarEnlargeSrc}
                      alt=""
                      className="w-full h-full object-cover object-top"
                      onError={onPhotoError}
                    />
                  </div>
                </PulsingAvatar>
              </button>
            ) : (
              <div
                className="inline-flex shrink-0 rounded-full ring-2 ring-[var(--copper)] shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
                data-testid={`drawer-avatar-${user.id}`}
              >
                <PulsingAvatar isPulsing={isPulsing} size={72} intensity="subtle">
                  <div
                    className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg,var(--bg-elevated),var(--bg-card))",
                    }}
                  >
                    <SilhouetteAvatar size={72} variant="card" />
                  </div>
                </PulsingAvatar>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-0 flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-2 pb-4">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h2 className="font-display text-2xl font-bold tracking-wide uppercase text-[var(--cream)] truncate">
              {user.name}
            </h2>
            {user.age ? (
              <span className="text-[var(--cream-soft)] text-lg font-semibold">{user.age}</span>
            ) : null}
            {(user as { is_verified?: boolean }).is_verified ? <VerifiedBadge /> : null}
          </div>
          <p className="text-sm font-medium text-[var(--cream-soft)] leading-snug">
            {user.online ? "Active now" : "Offline"} · {distLabel} away
          </p>

          {user.headline && (
            <p className="mt-3 text-sm text-[var(--cream)] leading-relaxed italic">
              "{user.headline}"
            </p>
          )}

          {user.looking_for ? (
            <div className="mt-4" data-testid="drawer-looking-for">
              <p className="text-[10px] font-black text-[var(--cream-muted)] uppercase tracking-[.18em] mb-1">
                Looking for
              </p>
              <p className="text-sm font-semibold text-[var(--copper)]">{user.looking_for}</p>
            </div>
          ) : null}

          {user.mood ? (
            <p className="mt-2 text-[12px] text-[var(--cream-muted)] leading-snug">
              Mood:{" "}
              <span className="font-semibold text-[var(--cream)]">
                {String(user.mood).replace(/_/g, " ")}
              </span>
            </p>
          ) : null}

          {user.interests && user.interests.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-black text-[var(--cream-muted)] uppercase tracking-[.18em] mb-2">
                Interests
              </p>
              <div className="flex flex-wrap gap-1.5">
                {user.interests.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--cream)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user.bio && (
            <div className="mt-4">
              <p className="text-[10px] font-black text-[var(--cream-muted)] uppercase tracking-[.18em] mb-2">
                About
              </p>
              <p className="text-sm text-[var(--cream)] leading-relaxed whitespace-pre-line">{user.bio}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--border-default)] p-4 flex flex-col gap-2 bg-[var(--bg-elevated)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(profilePathForUser(user.id, authUserId));
            }}
            className="w-full py-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--cream)] font-bold text-sm hover:border-[var(--copper)] hover:text-[var(--copper)] transition-colors"
          >
            View full profile
          </button>
          <div className="flex gap-2">
            {onPass && (
              <button
                onClick={onPass}
                className="flex-1 py-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--cream)] font-bold text-sm hover:text-[var(--copper)] hover:border-[var(--copper)] transition-colors"
              >
                Pass
              </button>
            )}
            <button
              type="button"
              disabled={matchDisabled}
              aria-disabled={matchDisabled}
              aria-label={matchCtaAriaLabel(matchState, user.name, {
                mutualOpensChat: true,
              })}
              onClick={() => {
                if (matchState === "mutual") onMessage();
                else if (matchState === "none") void onLike();
              }}
              data-testid={
                matchState === "mutual" ? "drawer-open-chat" : "drawer-match"
              }
              className={`flex-1 py-3.5 rounded-[var(--radius-md)] font-black text-sm tracking-wide transition-all ${
                matchState === "none" ? "uppercase active:scale-[0.98]" : ""
              } ${matchState === "mutual" ? "normal-case" : ""} ${matchCtaToneClasses(matchState)}`}
            >
              {matchLabel}
            </button>
            {onPulseBack && isPulsing && (
              <button
                type="button"
                onClick={onPulseBack}
                className="px-4 py-3 rounded-[var(--radius-md)] border border-[var(--copper)] text-[var(--copper)] font-bold text-sm flex items-center gap-1.5 hover:bg-[var(--copper)]/10 transition-colors"
                title="Pulse back"
              >
                <IconPulse size={16} />
                Back
              </button>
            )}
          </div>
          <p className="text-center text-[11px] font-semibold tracking-wide text-[var(--cream-soft)]">
            Match is mutual interest · Chat with consent
          </p>
        </div>
      </div>
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
