import { useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';

interface CoinFlipProps {
  qrValue: string;
  sizeClass?: string;
  qrLabel?: string;
}

/**
 * 3-D spinning coin.
 * Front  → NearNow bronze medallion (logo.png)
 * Back   → AI-generated bronze coin back (coin-back-ai.webp)
 *          with a real scannable QR code overlaid on the engraved area.
 */
export const CoinFlip = ({ qrValue, sizeClass = 'h-40', qrLabel: _qrLabel }: CoinFlipProps) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const qrInstance = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!qrRef.current) return;

    // Size the QR to fill ~55% of the coin face (matches the engraved square in the AI art)
    const size = 90;

    qrInstance.current = new QRCodeStyling({
      width: size,
      height: size,
      type: 'svg',
      data: qrValue,
      margin: 2,
      qrOptions: { errorCorrectionLevel: 'M' },

      // Teal-copper dots to blend with the verdigris patina in the engraving
      dotsOptions: {
        type: 'classy-rounded',
        gradient: {
          type: 'radial',
          rotation: 0,
          colorStops: [
            { offset: 0, color: '#1a5c52' },  // dark teal — matches patina shadow
            { offset: 1, color: '#0d3830' },  // deeper teal for outer dots
          ],
        },
      },

      cornersSquareOptions: {
        type: 'extra-rounded',
        gradient: {
          type: 'linear',
          rotation: 45,
          colorStops: [
            { offset: 0, color: '#7a4a10' },  // warm bronze
            { offset: 1, color: '#3e2008' },  // dark copper shadow
          ],
        },
      },

      cornersDotOptions: {
        type: 'dot',
        color: '#5a3a0e',
      },

      backgroundOptions: {
        color: 'transparent',
      },

      // No centre logo — keep the QR clean and scannable
    });

    qrRef.current.innerHTML = '';
    qrInstance.current.append(qrRef.current);
  }, [qrValue]);

  return (
    <div className={`coin-container ${sizeClass}`} style={{ aspectRatio: '1 / 1' }}>
      <div className="coin-inner">

        {/* ── FRONT — NearNow bronze medallion ── */}
        <div className="coin-face coin-front">
          <img
            src="/logo.png"
            alt="NearNow"
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        {/* ── BACK — AI-generated coin + scannable QR overlay ── */}
        <div className="coin-face coin-back">
          {/* AI photo fills the entire face */}
          <img
            src="/coin-back-ai.webp"
            alt="NearNow QR"
            className="absolute inset-0 h-full w-full object-cover rounded-full"
            draggable={false}
          />

          {/* Scannable QR overlaid on the engraved square — centred, slightly above midpoint */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              inset: 0,
              paddingBottom: '18%',   // shift up to sit over the engraved QR, above NEARNOW text
            }}
          >
            <div
              ref={qrRef}
              style={{
                opacity: 0.82,        // semi-transparent so the engraving texture shows through
                mixBlendMode: 'multiply',
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
