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
  // Badge scales with avatar; clamp so it stays legible on tiny markers.
  const badgeSize = Math.max(14, Math.round(size * 0.32));
  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="relative z-10 w-full h-full rounded-full overflow-hidden">
        {children}
      </div>

      {isPulsing && (
        <>
          <div
            className="absolute inset-0 rounded-full pointer-events-none animate-pulse-breathe"
            style={{
              boxShadow: `0 0 0 2px var(--copper), 0 0 14px var(--copper-glow-strong)`,
            }}
            aria-hidden
          />

          {intensity === "live" && (
            <>
              <div
                className="absolute inset-0 rounded-full pointer-events-none animate-pulse-ring"
                style={{
                  border: `2px solid var(--copper)`,
                  animationDelay: "0s",
                }}
                aria-hidden
              />
              <div
                className="absolute inset-0 rounded-full pointer-events-none animate-pulse-ring"
                style={{
                  border: `2px solid var(--copper)`,
                  animationDelay: "1s",
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
