import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '../hooks/store';
import { ProfileQrScanner } from './ProfileQrScanner';
import { parseProfileId, profileUrl as buildProfileUrl } from '../lib/profileLinks';

interface ProfileQrModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileQrModal({ open, onClose }: ProfileQrModalProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [pasteValue, setPasteValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);

  const shareUrl = useMemo(() => {
    if (!user?.id) return '';
    return buildProfileUrl(user.id);
  }, [user?.id]);

  const openProfile = useCallback(
    (raw: string) => {
      const id = parseProfileId(raw);
      if (!id) return;
      setScanning(false);
      onClose();
      navigate(`/profile/${id}`);
    },
    [navigate, onClose],
  );

  useEffect(() => {
    if (!open) {
      setPasteValue('');
      setCopied(false);
      setScanning(false);
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
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenPasted = () => openProfile(pasteValue);

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
            {shareUrl ? (
              <div className="mx-auto mt-4 inline-flex rounded-2xl bg-white p-3">
                <QRCodeSVG value={shareUrl} size={168} level="M" includeMargin={false} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#A89070]">Sign in to show your QR code.</p>
            )}
            {shareUrl && (
              <>
                <p className="mt-3 break-all text-[11px] leading-relaxed text-[#A89070]">{shareUrl}</p>
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A89070]">Open a profile</p>
              <button
                type="button"
                onClick={() => setScanning((value) => !value)}
                className="rounded-lg border border-[#3D2B0E] px-2.5 py-1 text-[11px] font-semibold text-[#F0E0C0] transition-colors hover:border-[#C4832A]/50"
              >
                {scanning ? 'Paste link' : 'Scan QR'}
              </button>
            </div>
            {scanning ? (
              <>
                <p className="mt-1 text-xs leading-relaxed text-[#A89070]">
                  Point your camera at a MenRush profile QR code.
                </p>
                <div className="mt-3">
                  <ProfileQrScanner active={open && scanning} onScan={openProfile} />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
