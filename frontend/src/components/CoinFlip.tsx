import { BRAND_MEDALLION } from '../lib/brand';

interface CoinFlipProps {
  qrValue: string;
  sizeClass?: string;
  qrLabel?: string;
  noFlip?: boolean;
}

export const CoinFlip = ({ sizeClass = 'h-40' }: CoinFlipProps) => {
  return (
    <div className={`${sizeClass}`} style={{ aspectRatio: '1 / 1' }}>
      <img
        src={BRAND_MEDALLION}
        alt="MenRush"
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
};
