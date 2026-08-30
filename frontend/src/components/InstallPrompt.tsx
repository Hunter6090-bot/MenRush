import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { registerServiceWorker } from '../lib/push';

const DISMISS_KEY = 'menrush_install_prompt_dismissed';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isIosSafari() {
  const ua = navigator.userAgent || '';
  if (!isIos()) return false;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|TikTok/i.test(ua);
}

function isDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (raw === '1') return true;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt({ variant }: { variant: 'card' | 'sheet' }) {
  const location = useLocation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [coaching, setCoaching] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (location.pathname === '/get-the-app' || location.pathname === '/install') return;
    if (isDismissed()) return;

    setHidden(false);
    void registerServiceWorker();
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [location.pathname]);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const installNative = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  const onInstall = () => {
    if (deferred) {
      void installNative();
      return;
    }
    setCoaching(true);
  };

  const wrap =
    variant === 'sheet'
      ? 'fixed inset-x-0 bottom-0 z-[60] border-t border-[rgba(196,131,42,0.35)] bg-[#140E08] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4'
      : 'mt-4 rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(20,14,8,0.72)] px-4 py-4';

  const ios = isIos();
  const safari = isIosSafari();

  return (
    <aside className={wrap} role="dialog" aria-label="Install MenRush">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C4832A]">Get the app</p>
      <p className="mt-1 text-[17px] font-extrabold leading-tight text-[#F0E0C0]">Put MenRush on your Home Screen.</p>
      <p className="mt-1 text-[13px] leading-snug text-[#A89070]">
        {ios
          ? safari
            ? 'Opens like an app. Safari only. No store.'
            : 'Open this page in Safari to install. Chrome and in-app browsers cannot add it.'
          : 'Opens like an app. No store. No extra download.'}
      </p>

      {coaching ? (
        <ol className="mt-3 space-y-2 text-[13px] leading-snug text-[#F0E0C0]">
          {ios ? (
            safari ? (
              <>
                <li>1. Tap Share — the square with the arrow on the Safari bar.</li>
                <li>2. Tap Add to Home Screen.</li>
                <li>3. Tap Add. Then open MenRush from the Home Screen.</li>
              </>
            ) : (
              <>
                <li>1. Tap the Share / Open in Safari button in this browser.</li>
                <li>2. Open menrush.com in Safari.</li>
                <li>3. Tap Share, then Add to Home Screen.</li>
              </>
            )
          ) : (
            <>
              <li>1. Tap the three dots in Chrome.</li>
              <li>2. Tap Install app or Add to Home screen.</li>
              <li>3. Tap Install.</li>
            </>
          )}
        </ol>
      ) : null}

      <div className="mt-3 flex gap-2.5">
        {!coaching ? (
          <button
            type="button"
            onClick={onInstall}
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-[14px] font-bold text-[#FFF6E6]"
          >
            Install the app
          </button>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-[14px] font-bold text-[#FFF6E6]"
          >
            Done
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-[rgba(196,131,42,0.35)] px-4 py-3 text-[14px] font-bold text-[#F0E0C0]"
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
