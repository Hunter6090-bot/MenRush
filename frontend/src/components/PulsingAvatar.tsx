import { ReactNode } from "react";

interface PulsingAvatarProps {
  isPulsing: boolean;
  size?: number;
  intensity?: "subtle" | "live";
  children: ReactNode;
  className?: string;
  isVerified?: boolean;
}

export function PulsingAvatar({
  isPulsing,
  size = 56,
  intensity = "subtle",
  children,
  className = "",
  isVerified = false,
}: PulsingAvatarProps) {
  const badgeSize = Math.max(14, Math.round(size * 0.32));
  const isLive = isPulsing && intensity === "live";
  const ringInset = Math.round(size * -0.35);

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      {isLive && (
        <>
          <div
            className="pointer-events-none absolute rounded-full nn-radar-1"
            style={{
              inset: ringInset,
              border: "2px solid var(--copper)",
              opacity: 0.85,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute rounded-full nn-radar-2"
            style={{
              inset: ringInset,
              border: "2px solid var(--copper-light)",
              opacity: 0.65,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute rounded-full nn-radar-3"
            style={{
              inset: ringInset,
              border: "2px solid var(--copper)",
              opacity: 0.45,
            }}
            aria-hidden
          />
        </>
      )}

      <div className="relative z-10 w-full h-full rounded-full overflow-hidden">
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
          aria-label="ID verified"
          title="Government-ID verified"
          className="absolute z-20 rounded-full flex items-center justify-center"
          style={{
            width: badgeSize,
            height: badgeSize,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(135deg, #D4943B 0%, #C4832A 50%, #8B4513 100%)",
            border: "1.5px solid #0D0A06",
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,225,180,0.45), inset 0 -1px 0 rgba(0,0,0,0.35)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={Math.round(badgeSize * 0.6)}
            height={Math.round(badgeSize * 0.6)}
            fill="none"
            stroke="#0D0A06"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
    </div>
  );
}
