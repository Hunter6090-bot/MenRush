import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '../hooks/store';

interface ProfileQrModalProps {
  open: boolean;
  onClose: () => void;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function parseProfileId(input: string): string | null {
  const match = input.trim().match(UUID_RE);
  return match?.[0] ?? null;
}

export function ProfileQrModal({ open, onClose }: ProfileQrModalProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [pasteValue, setPasteValue] = useState('');
  const [copied, setCopied] = useState(false);

  const profileUrl = useMemo(() => {
    if (!user?.id || typeof window === 'undefined') return '';
    return `${window.location.origin}/profile/${user.id}`;
  }, [user?.id]);

  useEffect(() => {
    if (!open) {
      setPasteValue('');
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenPasted = () => {
    const id = parseProfileId(pasteValue);
    if (!id) return;
    onClose();
    navigate(`/profile/${id}`);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-20 sm:pt-24"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile QR code"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#3D2B0E] bg-[#0D0A06] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#3D2B0E] px-4 py-3">
          <h2 className="text-sm font-bold text-[#F0E0C0]">Profile QR</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-[#A89070] hover:text-[#F0E0C0]"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A89070]">Your code</p>
            <p className="mt-1 text-sm font-bold text-[#F0E0C0]">{user?.name ?? 'Your profile'}</p>
            {profileUrl ? (
              <div className="mx-auto mt-4 inline-flex rounded-2xl bg-white p-3">
                <QRCodeSVG value={profileUrl} size={168} level="M" includeMargin={false} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#A89070]">Sign in to show your QR code.</p>
            )}
            {profileUrl && (
              <>
                <p className="mt-3 break-all text-[11px] leading-relaxed text-[#A89070]">{profileUrl}</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="mt-3 rounded-xl bg-[#C4832A] px-4 py-2 text-xs font-bold text-[#0D0A06] transition-opacity hover:opacity-90"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A89070]">Open a profile</p>
            <p className="mt-1 text-xs leading-relaxed text-[#A89070]">
              Paste a MenRush profile link or profile ID.
            </p>
            <input
              type="text"
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              placeholder="Profile link or ID"
              className="mt-3 w-full rounded-xl border border-[#3D2B0E] bg-[#0D0A06] px-3 py-2.5 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/70 focus:border-[#C4832A]/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleOpenPasted}
              disabled={!parseProfileId(pasteValue)}
              className="mt-3 w-full rounded-xl border border-[#3D2B0E] px-4 py-2.5 text-sm font-semibold text-[#F0E0C0] transition-colors enabled:hover:border-[#C4832A]/50 enabled:hover:bg-[#3D2B0E]/40 disabled:opacity-40"
            >
              Open profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
