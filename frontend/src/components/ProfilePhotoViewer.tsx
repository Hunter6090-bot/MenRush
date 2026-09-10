import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon } from './MobileBackButton';
import { armOverlayBack } from '../lib/overlayBack';
import { CHAT_IMAGE_VIEWER_FRAME } from '../lib/chatImageViewerFrame';

const PROFILE_PHOTO_OVERLAY_ID = 'profile-photo-viewer';

export interface ProfilePhotoViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/**
 * Full-screen enlarge viewer for profile/cover photos.
 * Reuses the chat photo viewer frame (Back/Close + contain box) without
 * view-once consume logic.
 */
export function ProfilePhotoViewer({ src, alt = 'Photo', onClose }: ProfilePhotoViewerProps) {
  const [status, setStatus] = useState<'loading' | 'shown' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const releaseOverlayRef = useRef<((opts?: { popEntry?: boolean }) => void) | null>(null);

  const url =
    attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}_retry=${attempt}` : src;

  const closeViewer = useCallback((fromUi: boolean) => {
    releaseOverlayRef.current?.({ popEntry: fromUi });
    releaseOverlayRef.current = null;
    onCloseRef.current();
  }, []);

  useEffect(() => {
    const release = armOverlayBack(PROFILE_PHOTO_OVERLAY_ID, () => {
      releaseOverlayRef.current = null;
      onCloseRef.current();
    });
    releaseOverlayRef.current = release;
    return () => {
      release();
      if (releaseOverlayRef.current === release) {
        releaseOverlayRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeViewer(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeViewer]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      data-testid="profile-photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      style={{ background: 'rgba(5,3,1,0.96)' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="flex flex-shrink-0 items-center justify-between gap-2 px-2 sm:px-3"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
        }}
        data-testid="profile-photo-viewer-chrome"
      >
        <button
          type="button"
          onClick={() => closeViewer(true)}
          aria-label="Back"
          data-testid="profile-photo-viewer-back"
          className="inline-flex min-h-[44px] min-w-[44px] items-center gap-0.5 rounded-xl px-2 text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.15)] active:scale-[0.98]"
        >
          <ChevronLeftIcon className="h-6 w-6 shrink-0" />
          <span className="pr-1 text-sm font-bold leading-none">Back</span>
        </button>
        <button
          type="button"
          onClick={() => closeViewer(true)}
          aria-label="Close photo"
          data-testid="profile-photo-viewer-close"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-[var(--cream)] transition-colors hover:bg-[rgba(196,131,42,0.15)] active:scale-[0.98]"
          style={{ background: 'rgba(30,21,8,0.9)', border: '1px solid var(--border-default)' }}
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
          <span className="text-sm font-bold leading-none">Close</span>
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeViewer(true);
        }}
      >
        {status === 'error' ? (
          <div className="flex flex-col items-center gap-3 px-8 text-center">
            <p className="text-sm" style={{ color: 'var(--cream)' }}>
              Couldn’t load this photo.
            </p>
            <button
              type="button"
              data-testid="profile-photo-viewer-retry"
              onClick={() => {
                setStatus('loading');
                setAttempt((n) => n + 1);
              }}
              className="mt-1 rounded-full px-5 py-2 text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg, #C4832A, #A45E18)', color: '#FFF5E6' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {status === 'loading' && (
              <div
                className="absolute text-sm font-medium text-[var(--cream-muted)]"
                data-testid="profile-photo-viewer-loading"
              >
                Loading…
              </div>
            )}
            <div
              data-testid="profile-photo-viewer-frame"
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: CHAT_IMAGE_VIEWER_FRAME.width,
                height: CHAT_IMAGE_VIEWER_FRAME.height,
                maxWidth: CHAT_IMAGE_VIEWER_FRAME.maxWidth,
                maxHeight: CHAT_IMAGE_VIEWER_FRAME.maxHeight,
                background: 'rgba(0,0,0,0.35)',
                borderRadius: 12,
              }}
            >
              <img
                key={attempt}
                src={url}
                alt={alt}
                data-testid="profile-photo-viewer-img"
                draggable={false}
                onLoad={() => setStatus('shown')}
                onError={() => setStatus('error')}
                className="h-full w-full select-none object-contain"
                style={{ opacity: status === 'shown' ? 1 : 0 }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
