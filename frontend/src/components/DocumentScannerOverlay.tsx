import type { IdDocumentTemplate } from './IdCaptureModal';

type OverlayMode = 'document' | 'selfie';

interface DocumentScannerOverlayProps {
  mode: OverlayMode;
  template?: IdDocumentTemplate;
  scanning?: boolean;
}

function CornerBracket({ className }: { className: string }) {
  return (
    <span
      className={`absolute h-7 w-7 border-[#C4832A] ${className}`}
      aria-hidden
    />
  );
}

export function DocumentScannerOverlay({
  mode,
  template = 'driving_license_front',
  scanning = false,
}: DocumentScannerOverlayProps) {
  const isPassport = template === 'passport';
  const frameClass =
    mode === 'selfie'
      ? 'h-[58%] w-[72%] rounded-[999px]'
      : isPassport
        ? 'h-[70%] w-[76%] rounded-lg'
        : 'aspect-[1.58/1] w-[86%] rounded-xl';

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Vignette outside scan area */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 68% 52% at 50% 48%, transparent 55%, rgba(0,0,0,0.72) 100%)',
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center p-5">
        <div className={`relative ${frameClass}`}>
          <CornerBracket className="left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-md" />
          <CornerBracket className="right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-md" />
          <CornerBracket className="bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-md" />
          <CornerBracket className="bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-md" />

          {mode === 'document' && template === 'driving_license_front' ? (
            <div className="absolute left-[7%] top-[14%] h-[72%] w-[32%] rounded border border-[#C4832A]/55 bg-[#C4832A]/10" />
          ) : null}
          {mode === 'document' && isPassport ? (
            <div className="absolute left-[9%] top-[20%] h-[34%] w-[26%] rounded border border-[#C4832A]/55 bg-[#C4832A]/10" />
          ) : null}

          {scanning ? (
            <div
              className="absolute inset-x-[6%] h-[2px] bg-gradient-to-r from-transparent via-[#C4832A] to-transparent shadow-[0_0_12px_#C4832A]"
              style={{ animation: 'scan-line 2.2s ease-in-out infinite' }}
            />
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