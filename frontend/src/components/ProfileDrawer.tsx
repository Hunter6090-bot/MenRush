import { useEffect, useState } from "react";
import { NearbyUser } from "./ProfileCard";
import { SilhouetteAvatar } from "./SilhouetteAvatar";
import { PulsingAvatar } from "./PulsingAvatar";
import { getPhotoUrl } from "./UserAvatar";
import { IconPulse } from "./icons";

interface ProfileDrawerProps {
  user: NearbyUser | null;
  liked: boolean;
  onClose: () => void;
  onLike: () => Promise<void> | void;
  onPass?: () => void;
  onMessage: () => void;
  onPulseBack?: () => Promise<void> | void;
}

export function ProfileDrawer({
  user,
  liked,
  onClose,
  onLike,
  onPass,
  onMessage,
  onPulseBack,
}: ProfileDrawerProps) {
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
  const distance = parseFloat(String(user.distance_km));
  const distLabel = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
  const isPulsing = !!user.available_until && new Date(user.available_until).getTime() > Date.now();

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center items-end sm:items-stretch sm:justify-end"
      onClick={onClose}
      style={{
        background: mounted ? "rgba(13,10,6,0.55)" : "rgba(13,10,6,0)",
        backdropFilter: mounted ? "blur(6px)" : "blur(0px)",
        transition: "background 220ms ease, backdrop-filter 220ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          relative w-full sm:w-[380px] sm:h-full
          max-h-[78vh] sm:max-h-none
          bg-[var(--bg-elevated)] border border-[var(--border-default)]
          rounded-t-3xl sm:rounded-none sm:rounded-l-2xl
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

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-[var(--bg-card)]/80 backdrop-blur-sm border border-[var(--border-default)] text-[var(--cream-soft)] hover:text-[var(--cream)] flex items-center justify-center"
          aria-label="Close"
        >
          ✕
        </button>

        <div
          className="relative w-full"
          style={{
            height: 320,
            background: "linear-gradient(135deg,#2A1C0A,#1E1508)",
          }}
        >
          {photo ? (
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
          {isPulsing && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--copper)] text-[var(--bg-primary)] text-[10px] font-black tracking-widest uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--bg-primary)] opacity-70" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--bg-primary)]" />
              </span>
              Pulsing
            </div>
          )}
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

          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-black text-[var(--cream)] truncate">
              {user.name}
              {user.age ? <span className="text-[var(--cream-soft)] font-bold">, {user.age}</span> : null}
            </h2>
          </div>
          <p className="text-xs text-[var(--copper)] font-bold tracking-wide">{distLabel} away{user.online ? " · Online" : ""}</p>

          {user.headline && (
            <p className="mt-3 text-sm text-[var(--cream-soft)] leading-relaxed italic">"{user.headline}"</p>
          )}

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

        <div className="border-t border-[var(--border-default)] p-4 flex gap-2 bg-[var(--bg-elevated)]">
          {onPass && (
            <button
              onClick={onPass}
              className="flex-1 py-3 rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--cream-soft)] font-bold text-sm hover:text-[var(--cream)] hover:border-[var(--copper)] transition-colors"
            >
              Pass
            </button>
          )}
          <button
            onClick={() => (liked ? onMessage() : onLike())}
            className="flex-1 py-3 rounded-[var(--radius-md)] bg-[var(--copper)] text-[var(--bg-primary)] font-black text-sm tracking-wide hover:bg-[var(--copper-light)] active:scale-[0.98] transition-all"
          >
            {liked ? "Message" : "Like"}
          </button>
          {onPulseBack && isPulsing && (
            <button
              onClick={onPulseBack}
              className="px-4 py-3 rounded-[var(--radius-md)] border border-[var(--copper)] text-[var(--copper)] font-bold text-sm flex items-center gap-1.5 hover:bg-[var(--copper)]/10 transition-colors"
              title="Pulse back"
            >
              <IconPulse size={16} />
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
