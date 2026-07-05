/**
 * MenRush brand mark — CSS radar pulse from the design system (motion-radar.html).
 * No bronze coin / medallion PNGs.
 */
type BrandMarkSize = 'sm' | 'md' | 'lg' | 'hero';

type BrandMarkProps = {
  size?: BrandMarkSize;
  showWordmark?: boolean;
  className?: string;
};

const sizeClasses: Record<
  BrandMarkSize,
  { stage: string; ring: string; core: string; wordmark: string }
> = {
  sm: {
    stage: 'h-10 w-10',
    ring: 'h-8 w-8',
    core: 'h-2.5 w-2.5',
    wordmark: 'text-lg tracking-[0.12em]',
  },
  md: {
    stage: 'h-20 w-20',
    ring: 'h-16 w-16',
    core: 'h-3.5 w-3.5',
    wordmark: 'text-xl tracking-[0.12em]',
  },
  lg: {
    stage: 'h-28 w-28 sm:h-32 sm:w-32',
    ring: 'h-24 w-24 sm:h-28 sm:w-28',
    core: 'h-5 w-5',
    wordmark: 'text-2xl tracking-[0.12em]',
  },
  hero: {
    stage: 'h-[150px] w-[150px]',
    ring: 'h-24 w-24',
    core: 'h-[22px] w-[22px]',
    wordmark: 'text-[26px] tracking-[0.12em]',
  },
};

export function BrandMark({ size = 'lg', showWordmark = false, className = '' }: BrandMarkProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      className={`inline-flex flex-col items-center ${className}`}
      data-testid="brand-mark"
      aria-label="MenRush"
    >
      <div className={`relative flex items-center justify-center ${sizes.stage}`}>
        <span
          className={`absolute ${sizes.ring} rounded-full bg-[#C4832A] opacity-55 animate-[mr-radar_2.4s_cubic-bezier(0.16,1,0.3,1)_infinite]`}
          aria-hidden
        />
        <span
          className={`absolute ${sizes.ring} rounded-full bg-[#C4832A] opacity-35 animate-[mr-radar_2.4s_cubic-bezier(0.16,1,0.3,1)_0.8s_infinite]`}
          aria-hidden
        />
        <span
          className={`absolute ${sizes.ring} rounded-full bg-[#C4832A] opacity-20 animate-[mr-radar_2.4s_cubic-bezier(0.16,1,0.3,1)_1.6s_infinite]`}
          aria-hidden
        />
        <span
          className={`relative z-[2] ${sizes.core} rounded-full border-2 border-[#F0E0C0] bg-[#C4832A] shadow-[0_0_22px_rgba(196,131,42,0.7),inset_0_1px_0_rgba(255,220,170,0.5)]`}
          aria-hidden
        />
      </div>
      {showWordmark ? (
        <p
          className={`mt-3.5 font-black uppercase text-[#F0E0C0] ${sizes.wordmark}`}
          aria-hidden
        >
          MENRUSH
        </p>
      ) : null}
    </div>
  );
}
