import { ReactNode } from "react";

interface PulsingAvatarProps {
  isPulsing: boolean;
  size?: number;
  intensity?: "subtle" | "live";
  children: ReactNode;
  className?: string;
  isVerified?: boolean;
  /** Map pins and drawer avatars are circular. Square is unused on Discover map. */
  shape?: "circle" | "square";
}

export function PulsingAvatar({
  isPulsing,
  size = 56,
  intensity = "subtle",
  children,
  className = "",
  isVerified = false,
  shape = "circle",
}: PulsingAvatarProps) {
  const isSquare = shape === "square";
  const clip = isSquare ? "overflow-hidden" : "rounded-full overflow-hidden";
  const ring = isSquare ? "" : "rounded-full";
  // Identity Checked pin mark — slightly larger so it reads on map markers.
  const badgeSize = Math.max(16, Math.round(size * 0.38));
  const isLive = isPulsing && intensity === "live";
  const ringInset = Math.round(size * -0.35);

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      data-avatar-shape={shape}
    >
      {isLive && (
        <>
          <div
            className={`pointer-events-none absolute ${ring} nn-radar-1`}
            style={{
              inset: ringInset,
              border: "2px solid var(--copper)",
              opacity: 0.85,
            }}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute ${ring} nn-radar-2`}
            style={{
              inset: ringInset,
              border: "2px solid var(--copper-light)",
              opacity: 0.65,
            }}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute ${ring} nn-radar-3`}
            style={{
              inset: ringInset,
              border: "2px solid var(--copper)",
              opacity: 0.45,
            }}
            aria-hidden
          />
        </>
      )}

      <div className={`relative z-10 w-full h-full ${clip}`}>
        {children}
      </div>

      {isPulsing && (
        <>
          <div
            className={`absolute inset-0 rounded-full pointer-events-none ${
              isLive ? "animate-pulse-breathe" : ""
            }`}
            style={{
              boxShadow: isLive
                ? `0 0 0 3px var(--copper), 0 0 22px var(--copper-glow-strong), 0 0 40px rgba(196,131,42,0.35)`
                : `0 0 0 2px var(--copper), 0 0 14px var(--copper-glow-strong)`,
            }}
            aria-hidden
          />

          {isLive && (
            <>
              <div
                className="absolute inset-0 rounded-full pointer-events-none animate-pulse-ring"
                style={{
                  border: `2px solid var(--copper-light)`,
                  animationDelay: "0s",
                }}
                aria-hidden
              />
              <div
                className="absolute inset-0 rounded-full pointer-events-none animate-pulse-ring-slow"
                style={{
                  border: `2px solid var(--copper)`,
                  animationDelay: "0.6s",
                }}
                aria-hidden
              />
            </>
          )}
        </>
      )}

      {isVerified && (
        <span
          data-testid="map-identity-checked-badge"
          aria-label="Verified"
          title="ID and live selfie verified through Veriff"
          className="absolute z-20 flex items-center justify-center pointer-events-none"
          style={{
            width: badgeSize,
            height: badgeSize,
            right: 0,
            bottom: 0,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={Math.round(badgeSize * 0.78)}
            height={Math.round(badgeSize * 0.78)}
            fill="none"
            stroke="#E0A14A"
            strokeWidth={3.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.85))' }}
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
    </div>
  );
}
