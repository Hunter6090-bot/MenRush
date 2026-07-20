/**
 * MenRush — SilhouetteAvatar
 *
 * The fallback avatar shown when a user hasn't uploaded a profile photo.
 * Replaces the embarrassing "single letter on copper card" avatars.
 *
 * Three variants based on context:
 *  - "card"  — for nearby user cards in lists
 *  - "map"   — for map markers (smaller, sharper)
 *  - "chat"  — for the chat header (medium)
 *
 * Renders an SVG bust silhouette in copper bas-relief on a graduated copper background.
 */

interface SilhouetteAvatarProps {
  size?: number;
  variant?: "card" | "map" | "chat";
  className?: string;
}

export function SilhouetteAvatar({
  size = 56,
  variant = "card",
  className = "",
}: SilhouetteAvatarProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 30% 30%, var(--copper-dark), var(--bg-card) 75%)",
        boxShadow: "inset 0 0 12px rgba(0,0,0,0.5), inset 0 1px 0 var(--copper-glow)",
      }}
    >
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="0 0 24 24"
        fill="var(--copper)"
        opacity={variant === "map" ? 0.95 : 0.85}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Classical bust — round head + broad shoulders */}
        <circle cx="12" cy="8.5" r="4.25" />
        <path d="M4 22 V16.5 C4 14.2 6.2 13 9 13 H15 C17.8 13 20 14.2 20 16.5 V22 Z" />
      </svg>
    </div>
  );
}

/**
 * Optional: a profile-facing variant (faces left or right, like the medallion)
 * Use this on Discover map for visual interest — alternate left/right per user.
 */
export function SilhouetteProfileAvatar({
  size = 56,
  facing = "right",
  className = "",
}: {
  size?: number;
  facing?: "left" | "right";
  className?: string;
}) {
  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 30% 30%, var(--copper-dark), var(--bg-card) 75%)",
        boxShadow: "inset 0 0 12px rgba(0,0,0,0.5), inset 0 1px 0 var(--copper-glow)",
      }}
    >
      <svg
        width={size * 0.75}
        height={size * 0.75}
        viewBox="0 0 24 24"
        fill="var(--copper)"
        opacity="0.9"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: facing === "left" ? "scaleX(-1)" : "none" }}
      >
        {/* Profile silhouette — head + shoulders facing right (mirrors medallion) */}
        <path
          d="M14 8.5 C14 6 12 4 9.5 4 C7 4 5 6 5 8.5 C5 10 5.8 11.3 7 12 L7 13 C5 13.5 3 14.5 3 17 L3 22 L17 22 L17 16 L21 16 L21 11 L17 11 L17 8.5 C17 7 15.5 6 14 6 Z"
        />
      </svg>
    </div>
  );
}
