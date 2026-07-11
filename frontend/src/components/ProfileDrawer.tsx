import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NearbyUser } from "./ProfileCard";
import { SilhouetteAvatar } from "./SilhouetteAvatar";
import { PulsingAvatar } from "./PulsingAvatar";
import { getPhotoUrl } from "./UserAvatar";
import { IconPulse, IconClose } from "./icons";
import { StatusBadge } from "./StatusBadge";
import { DistancePill } from "./DistancePill";
import { VerifiedBadge } from "./VerifiedBadge";
import { ChatSafetyMenu } from "./ChatSafetyMenu";
import { getDistanceLabel, isUserPulsing } from "../lib/discovery";

interface ProfileDrawerProps {
  user: NearbyUser | null;
  liked: boolean;
  onClose: () => void;
  onLike: () => Promise<void> | void;
  onPass?: () => void;
  onMessage: () => void;
  onPulseBack?: () => Promise<void> | void;
  /** Safety feedback after report/block (18+ trust & safety). */
  onSafetyNotice?: (message: string, tone?: 'success' | 'error') => void;
  onBlocked?: () => void;
}

export function ProfileDrawer({
  user,
  liked,
  onClose,
  onLike,
  onPass,
  onMessage,
  onPulseBack,
  onSafetyNotice,
  onBlocked,
}: ProfileDrawerProps) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!user) {
      setMounted(false);
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

  if (!user) return null;

  const photo = getPhotoUrl(user.photo_url);
  const cover = getPhotoUrl(user.cover_url);
  const distance = parseFloat(String(user.distance_km));
  const distLabel = getDistanceLabel(user);
  const isPulsing = isUserPulsing(user);

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
        onClick={(e) => e.stopPropagation()}
        className="
          relative w-full lg:w-[420px] lg:h-full
          max-h-[78vh] lg:max-h-none
          bg-[var(--bg-elevated)] border border-[var(--border-default)]
          rounded-t-3xl lg:rounded-none lg:rounded-l-2xl
          shadow-[var(--shadow-glow-strong)]
          overflow-hidden flex flex-col
        "
        style={{
          transform: mounted
            ? "translate3d(0,0,0)"
            : window.innerWidth >= 640
            ? "translate3d(100%,0,0)"
            : "translate3d(0,100%,0)",
          transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-[var(--border-default)] mx-auto mt-3" />

        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <div className="rounded-full bg-nn-bg/70 border border-nn-border">
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
            className="w-9 h-9 rounded-full bg-nn-bg/70 border border-nn-border text-nn-text hover:border-nn-copper/40 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div
          className="relative w-full"
          style={{
            height: 320,
            background: "linear-gradient(135deg,#2A1C0A,#1E1508)",
          }}
        >
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : photo ? (
            <img src={photo} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <SilhouetteAvatar size={180} variant="card" />
            </div>
          )}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to top, var(--bg-elevated) 0%, transparent 60%)" }}
          />
          {isPulsing ? (
            <div className="absolute top-3 left-3">
              <StatusBadge online={false} pulsing />
            </div>
          ) : user.online ? (
            <div className="absolute top-3 left-3">
              <StatusBadge online lastSeen={user.last_seen} size="xs" />
            </div>
          ) : null}
          <div className="absolute bottom-3 left-3">
            <DistancePill km={distance} label={distLabel} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-end justify-between gap-3 -mt-12 mb-4">
            <PulsingAvatar isPulsing={isPulsing} size={64} intensity="subtle">
              <div
                className="w-full h-full rounded-full overflow-hidden border-2 flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,#2A1C0A,#1E1508)",
                  borderColor: "var(--copper)",
                }}
              >
                {photo ? (
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <SilhouetteAvatar size={56} variant="card" />
                )}
              </div>
            </PulsingAvatar>
          </div>

          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="font-display text-2xl font-bold tracking-wide uppercase text-nn-text truncate">
              {user.name}
            </h2>
            {user.age ? <span className="text-nn-muted text-lg">{user.age}</span> : null}
            {(user as { is_verified?: boolean }).is_verified && <VerifiedBadge />}
          </div>
          <p className="text-xs text-nn-muted">
            {user.online ? 'Active now' : 'Offline'} · {distLabel} away
          </p>

          {user.headline && (
            <p className="mt-3 text-sm text-[var(--cream-soft)] leading-relaxed italic">"{user.headline}"</p>
          )}

          {user.looking_for ? (
            <div className="mt-3" data-testid="drawer-looking-for">
              <p className="text-[10px] font-black text-[var(--cream-muted)] uppercase tracking-[.18em] mb-1">
                Looking for
              </p>
              <p className="text-sm font-semibold text-[#E0A14A]">{user.looking_for}</p>
            </div>
          ) : null}

          {user.mood ? (
            <p className="mt-2 text-[12px] text-[var(--cream-muted)]">
              Mood: <span className="font-semibold text-[var(--cream-soft)]">{String(user.mood).replace(/_/g, ' ')}</span>
            </p>
          ) : null}

          {user.interests && user.interests.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-black text-[var(--cream-muted)] uppercase tracking-[.18em] mb-2">Interests</p>
              <div className="flex flex-wrap gap-1.5">
                {user.interests.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
                    style={{
                      background: "var(--bg-card)",
                      borderColor: "var(--border-default)",
                      color: "var(--cream-soft)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user.bio && (
            <div className="mt-4">
              <p className="text-[10px] font-black text-[var(--cream-muted)] uppercase tracking-[.18em] mb-2">About</p>
              <p className="text-sm text-[var(--cream)] leading-relaxed whitespace-pre-line">{user.bio}</p>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border-default)] p-4 flex flex-col gap-2 bg-[var(--bg-elevated)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/profile/${user.id}`);
            }}
            className="w-full py-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--cream-soft)] font-bold text-sm hover:border-[var(--copper)] hover:text-[var(--copper)] transition-colors"
          >
            View full profile
          </button>
          <div className="flex gap-2">
          {onPass && (
            <button
              onClick={onPass}
              className="flex-1 py-3 rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--cream-soft)] font-bold text-sm hover:text-[var(--cream)] hover:border-[var(--copper)] transition-colors"
            >
              Pass
            </button>
          )}
          <button
            type="button"
            onClick={() => (liked ? onMessage() : onLike())}
            className="flex-1 py-3 rounded-[var(--radius-md)] bg-[var(--copper)] text-[var(--bg-primary)] font-black text-sm tracking-wide hover:bg-[var(--copper-light)] active:scale-[0.98] transition-all"
          >
            {liked ? "Open chat" : "Match"}
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
          <p className="text-center text-[10px] font-medium tracking-wide text-[var(--cream-muted)]">
            Match is mutual interest · Chat with consent · 18+ only
          </p>
        </div>
      </div>
    </div>
  );
}
