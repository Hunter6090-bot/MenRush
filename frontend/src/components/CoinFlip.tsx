import { useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';

interface CoinFlipProps {
  qrValue: string;
  sizeClass?: string;
  qrLabel?: string;
  noFlip?: boolean;
}

/**
 * 3-D spinning coin.
 * Front  → MenRush bronze medallion (logo.png)
 * Back   → AI-generated bronze coin back (coin-back-ai.webp)
 *          with a real scannable QR code overlaid on the engraved area.
 */
export const CoinFlip = ({ qrValue, sizeClass = 'h-40', qrLabel: _qrLabel, noFlip = false }: CoinFlipProps) => {
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

  if (noFlip) {
    return (
      <div className={`${sizeClass}`} style={{ aspectRatio: '1 / 1' }}>
        <img
          src="/logo.png"
          alt="MenRush"
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className={`coin-container ${sizeClass}`} style={{ aspectRatio: '1 / 1' }}>
      <div className="coin-inner">

        {/* ── FRONT — MenRush bronze medallion ── */}
        <div className="coin-face coin-front">
          <img
            src="/logo.png"
            alt="MenRush"
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        {/* ── BACK — MenRush engraved coin + scannable QR overlay ── */}
        <div className="coin-face coin-back">
          {/* Coin photo fills the entire face */}
          <img
            src="/coin-back-menrush.jpg"
            alt="MenRush QR"
            className="absolute inset-0 h-full w-full object-cover rounded-full"
            draggable={false}
          />

          {/* Scannable QR overlaid on the engraved square — centred, shifted up above text area */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              inset: 0,
              paddingBottom: '22%',   // shift up to sit over the engraved QR, above MENRUSH text
            }}
          >
            <div
              ref={qrRef}
              style={{
                opacity: 0.75,
                mixBlendMode: 'multiply',
              }}
            />
          </div>

          {/* MENRUSH text overlay — covers the NEARNOW engraving at the bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
            style={{ paddingBottom: '10%' }}
          >
            <span
              style={{
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontWeight: 900,
                fontSize: '0.95rem',
                letterSpacing: '0.28em',
                color: '#C8924A',
                textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 -1px 0 rgba(255,210,120,0.3)',
                textTransform: 'uppercase',
              }}
            >
              MENRUSH
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
