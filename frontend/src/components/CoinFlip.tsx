import { useEffect, useRef, useState } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { BRAND_MEDALLION, BRAND_MEDALLION_REVERSE } from '../lib/brand';

interface CoinFlipProps {
  qrValue: string;
  sizeClass?: string;
  qrLabel?: string;
  noFlip?: boolean;
}

export const CoinFlip = ({
  qrValue,
  sizeClass = 'h-40',
  qrLabel = 'Scan to join',
  noFlip = false,
}: CoinFlipProps) => {
  const [flipped, setFlipped] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrInstance = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (noFlip || !qrRef.current) return;

    const size = 96;

    qrInstance.current = new QRCodeStyling({
      width: size,
      height: size,
      type: 'svg',
      data: qrValue,
      margin: 2,
      qrOptions: { errorCorrectionLevel: 'M' },
      dotsOptions: {
        type: 'classy-rounded',
        color: '#1E1508',
      },
      cornersSquareOptions: {
        type: 'extra-rounded',
        color: '#8B4513',
      },
      cornersDotOptions: {
        type: 'dot',
        color: '#C4832A',
      },
      backgroundOptions: {
        color: 'transparent',
      },
    });

    qrRef.current.innerHTML = '';
    qrInstance.current.append(qrRef.current);
  }, [qrValue, noFlip]);

  if (noFlip) {
    return (
      <div className={sizeClass} style={{ aspectRatio: '1 / 1' }}>
        <img
          src={BRAND_MEDALLION}
          alt="MenRush"
          className="h-full w-full rounded-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setFlipped((value) => !value)}
      aria-label={flipped ? 'Show MenRush logo' : 'Show MenRush QR code'}
      aria-pressed={flipped}
      className={`coin-container ${sizeClass} cursor-pointer border-0 bg-transparent p-0`}
      style={{ aspectRatio: '1 / 1' }}
    >
      <div className={`coin-inner ${flipped ? 'coin-inner-flipped' : ''}`}>
        <div className="coin-face coin-front">
          <img
            src={BRAND_MEDALLION}
            alt="MenRush"
            className="h-full w-full rounded-full object-cover"
            draggable={false}
          />
        </div>

        <div className="coin-face coin-back">
          <img
            src={BRAND_MEDALLION_REVERSE}
            alt=""
            className="absolute inset-0 h-full w-full rounded-full object-cover"
            draggable={false}
          />
          <div className="coin-back-inner">
            <div ref={qrRef} className="coin-back-qr" aria-hidden />
            <div className="coin-back-divider" aria-hidden />
            <p className="coin-back-label">{qrLabel}</p>
          </div>
        </div>
      </div>
    </button>
  );
};
