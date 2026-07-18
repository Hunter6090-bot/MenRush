import { QRCodeSVG } from 'qrcode.react';

interface VerificationQrProps {
  url: string;
  label?: string;
  className?: string;
}

export function VerificationQr({
  url,
  label = 'Scan with your phone',
  className = '',
}: VerificationQrProps) {
  return (
    <div
      className={`rounded-xl border border-[#3D2B0E]/80 bg-[#0D0A06]/55 px-4 py-4 text-center ${className}`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#C4832A]">{label}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--cream-muted)]">
        Open your phone camera and scan to photograph your ID with the rear camera.
      </p>
      <div className="mx-auto mt-4 inline-flex rounded-xl bg-[#F0E0C0] p-3 shadow-card">
        <QRCodeSVG value={url} size={168} level="M" includeMargin={false} />
      </div>
      <p className="mt-3 text-[10px] leading-snug text-[#6B5840]">
        This page updates automatically once your ID is captured.
      </p>
    </div>
  );
}