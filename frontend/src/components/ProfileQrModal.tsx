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
      if (event.key === 'Escape') {
        if (scanning) setScanning(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, scanning]);

  useEffect(() => {
    if (!open || !scanning) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, scanning]);

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

  if (scanning) {
    return (
      <div
        className="fixed inset-0 z-[130] flex flex-col bg-[#0D0A06]"
        role="dialog"
        aria-modal="true"
        aria-label="Scan profile QR code"
        data-testid="profile-qr-scan-screen"
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-[#3D2B0E] px-4 py-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={() => setScanning(false)}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#C4832A]"
          >
            ← Paste link
          </button>
          <h2 className="text-sm font-bold text-[#F0E0C0]">Scan profile QR</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-[#A89070]"
          >
            Close
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          <ProfileQrScanner active layout="fullscreen" onScan={openProfile} />
        </div>

        <p
          className="shrink-0 px-4 py-3 text-center text-xs leading-relaxed text-[#A89070]"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          Line up the QR code inside the frame. Scanning stops automatically when a profile is found.
        </p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-start sm:justify-center sm:px-4 sm:pt-24"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile QR code"
        className="max-h-[min(92dvh,720px)] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-[#3D2B0E] bg-[#0D0A06] shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:rounded-2xl"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
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
                onClick={() => setScanning(true)}
                className="rounded-lg border border-[#C4832A]/50 bg-[#C4832A]/15 px-3 py-1.5 text-[11px] font-bold text-[#C4832A]"
                data-testid="profile-qr-scan-open"
              >
                Scan QR
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#A89070]">
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
