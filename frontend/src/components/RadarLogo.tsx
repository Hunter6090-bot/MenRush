/** Animated MenRush medallion with copper radar rings (Coming Soon only). */
export function RadarLogo({ size = 110 }: { size?: number }) {
  const ringSize = Math.round(size * 0.87);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size + 40, height: size + 40 }}
    >
      <span
        className="absolute rounded-full bg-[#C4832A] animate-mr-radar"
        style={{ width: ringSize, height: ringSize }}
        aria-hidden
      />
      <span
        className="absolute rounded-full bg-[#C4832A] opacity-30 animate-mr-radar [animation-delay:1.2s]"
        style={{ width: ringSize, height: ringSize }}
        aria-hidden
      />
      <img
        src="/menrush-logo.png"
        alt="MenRush"
        className="relative z-[2] rounded-full object-cover shadow-[0_0_0_2px_rgba(196,131,42,0.4),0_12px_44px_rgba(0,0,0,0.7)]"
        style={{ width: size, height: size }}
      />
    </div>
  );
}