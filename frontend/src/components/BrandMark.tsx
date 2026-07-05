/**
 * MenRush brand mark — static two-profile bronze medallion (handoff medallion-480.png).
 */
import { BRAND_MEDALLION, BRAND_MEDALLION_SMALL } from '../lib/brand';

type BrandMarkSize = 'sm' | 'auth' | 'md' | 'lg' | 'hero';

type BrandMarkProps = {
  size?: BrandMarkSize;
  /** @deprecated Medallion PNG already includes the MENRUSH inscription. */
  showWordmark?: boolean;
  /** @deprecated Use default stacked medallion layout. */
  layout?: 'stacked' | 'inline';
  className?: string;
};

const sizeClasses: Record<BrandMarkSize, { src: string; box: string }> = {
  sm: { src: BRAND_MEDALLION_SMALL, box: 'h-10 w-10' },
  auth: { src: BRAND_MEDALLION, box: 'h-[52px] w-[52px]' },
  md: { src: BRAND_MEDALLION, box: 'h-20 w-20' },
  lg: { src: BRAND_MEDALLION, box: 'h-28 w-28 sm:h-32 sm:w-32' },
  hero: { src: BRAND_MEDALLION, box: 'h-[150px] w-[150px]' },
};

export function BrandMark({ size = 'lg', className = '' }: BrandMarkProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      data-testid="brand-mark"
      aria-label="MenRush"
    >
      <img
        src={sizes.src}
        alt="MenRush"
        className={`${sizes.box} rounded-full object-cover`}
        draggable={false}
      />
    </div>
  );
}
