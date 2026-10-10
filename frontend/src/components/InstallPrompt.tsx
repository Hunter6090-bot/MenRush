import { Link, useLocation } from 'react-router-dom';
import { isPhoneDevice } from '../lib/device';
import {
  clearDeferredInstallPrompt,
  useDeferredInstallPrompt,
} from '../lib/installPromptStore';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'menrush_install_prompt_dismissed';

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

export function InstallPrompt({ variant }: { variant: 'card' | 'sheet' }) {
  const location = useLocation();
  const deferred = useDeferredInstallPrompt();
  const [hidden, setHidden] = useState(true);

  // Never cover chat/room composers or Settings Sign out — sheet sits at z-60.
  const blocksChrome =
    location.pathname.startsWith('/messages') ||
    location.pathname.startsWith('/conversations') ||
    location.pathname.startsWith('/settings') ||
    /^\/rooms\/[^/]+/.test(location.pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isPhoneDevice()) {
      setHidden(true);
      return;
    }
    if (isStandalone()) {
      setHidden(true);
      return;
    }
    if (location.pathname === '/get-the-app' || location.pathname === '/install') {
      setHidden(true);
      return;
    }
    if (blocksChrome) {
      setHidden(true);
      return;
    }
    if (variant === 'sheet' && localStorage.getItem(DISMISS_KEY) === '1') {
      setHidden(true);
      return;
    }

    setHidden(false);
  }, [location.pathname, variant, blocksChrome]);

  if (hidden || blocksChrome) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  // Android Chrome can one-tap install when we still hold the deferred event.
  // iPhone / Safari cannot — keep Show me how. Android without a prompt falls
  // back to the Chrome-menu how-to (in-app browser, criteria not met, etc.).
  const canNativeInstall = Boolean(deferred) && !isIos();

  const install = async () => {
    if (!deferred || isIos()) return;
    await deferred.prompt();
    await deferred.userChoice;
    clearDeferredInstallPrompt();
    dismiss();
  };

  const wrap =
    variant === 'sheet'
      ? 'fixed inset-x-0 bottom-0 z-[60] border-t border-[rgba(196,131,42,0.35)] bg-[#140E08] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4'
      : 'mt-4 rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(20,14,8,0.72)] px-4 py-4';

  return (
    <aside className={wrap} role="dialog" aria-label="Install MenRush">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C4832A]">Get the app</p>
      <p className="mt-1 text-[17px] font-extrabold leading-tight text-[#F0E0C0]">Put MenRush on your Home Screen.</p>
      <p className="mt-1 text-[13px] leading-snug text-[#A89070]">
        {isIos()
          ? 'Safari only. Share, then Add to Home Screen.'
          : 'Opens like an app. No store. No extra download.'}
      </p>
      <div className="mt-3 flex gap-2.5">
        {canNativeInstall ? (
          <button
            type="button"
            onClick={() => void install()}
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-[14px] font-bold text-[#FFF6E6]"
          >
            Install app
          </button>
        ) : (
          <Link
            to="/get-the-app"
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-center text-[14px] font-bold text-[#FFF6E6]"
          >
            Show me how
          </Link>
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
