import type { IdDocumentTemplate } from './IdCaptureModal';

type OverlayMode = 'document' | 'selfie';

interface DocumentScannerOverlayProps {
  mode: OverlayMode;
  template?: IdDocumentTemplate;
  /** Red when false (misaligned); green when true (good snap). */
  aligned?: boolean;
}

function CornerBracket({ className, colorClass }: { className: string; colorClass: string }) {
  return (
    <span
      className={`absolute h-7 w-7 ${colorClass} ${className}`}
      aria-hidden
    />
  );
}

export function DocumentScannerOverlay({
  mode,
  template = 'driving_license_front',
  aligned = false,
}: DocumentScannerOverlayProps) {
  const isPassport = template === 'passport';
  const frameClass =
    mode === 'selfie'
      ? 'h-[68%] aspect-[3/4] max-w-[68%] rounded-[50%]'
      : isPassport
        ? 'h-[70%] w-[76%] rounded-lg'
        : 'aspect-[1.58/1] w-[86%] rounded-xl';

  const frameColor = aligned ? '#22C55E' : '#EF4444';
  const guideColor = aligned ? 'border-[#22C55E]/55 bg-[#22C55E]/10' : 'border-[#EF4444]/45 bg-[#EF4444]/8';
  const bracketClass = aligned ? 'border-[#22C55E]' : 'border-[#EF4444]';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`relative transition-shadow duration-200 ${frameClass}`}
          style={{
            boxShadow: aligned
              ? `0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 2px ${frameColor}, 0 0 28px ${frameColor}66`
              : `0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 2px ${frameColor}99`,
          }}
        >
          <CornerBracket colorClass={bracketClass} className="left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-md" />
          <CornerBracket colorClass={bracketClass} className="right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-md" />
          <CornerBracket colorClass={bracketClass} className="bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-md" />
          <CornerBracket colorClass={bracketClass} className="bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-md" />

          {mode === 'document' && template === 'driving_license_front' ? (
            <div className={`absolute left-[7%] top-[14%] h-[72%] w-[32%] rounded border ${guideColor}`} />
          ) : null}
          {mode === 'document' && isPassport ? (
            <div className={`absolute left-[9%] top-[20%] h-[34%] w-[26%] rounded border ${guideColor}`} />
          ) : null}

          {aligned ? (
            <div
              className="absolute inset-x-[6%] h-[2px] bg-gradient-to-r from-transparent via-[#22C55E] to-transparent shadow-[0_0_12px_#22C55E]"
              style={{ animation: 'scan-line 0.9s ease-in-out infinite' }}
            />
          ) : null}

          {mode === 'document' ? (
            <span className="absolute inset-x-0 -bottom-8 text-center text-[11px] font-semibold text-white/85">
              Only the area inside this frame is saved
            </span>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes scan-line {
          0%, 100% { top: 12%; opacity: 0.35; }
          50% { top: 86%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
