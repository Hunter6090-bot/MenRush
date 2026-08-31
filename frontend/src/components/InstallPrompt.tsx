import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isAndroidChrome, openAndroidPlayInstall } from '../lib/androidTwa';
import { isPhoneDevice } from '../lib/device';
import { registerServiceWorker } from '../lib/push';

const DISMISS_KEY = 'menrush_install_prompt_dismissed';

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

export function InstallPrompt({ variant }: { variant: 'card' | 'sheet' }) {
  const location = useLocation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [androidChrome, setAndroidChrome] = useState(false);

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

    setAndroidChrome(isAndroidChrome());
    setHidden(false);
    void registerServiceWorker();
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [location.pathname, variant, blocksChrome]);

  if (hidden || blocksChrome) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  const installPwa = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  const installAndroid = () => {
    if (deferred) {
      void installPwa();
      return;
    }
    openAndroidPlayInstall();
    dismiss();
  };

  const wrap =
    variant === 'sheet'
      ? 'fixed inset-x-0 bottom-0 z-[60] border-t border-[rgba(196,131,42,0.35)] bg-[#140E08] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4'
      : 'mt-4 rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(20,14,8,0.72)] px-4 py-4';

  const subtitle = isIos()
    ? 'Safari only. Share, then Add to Home Screen.'
    : androidChrome
      ? deferred
        ? 'Install from Chrome — opens like a native app.'
        : 'Get the Play Store app (Trusted Web Activity) or add to Home Screen.'
      : 'Opens like an app. No store. No extra download.';

  return (
    <aside className={wrap} role="dialog" aria-label="Install MenRush" data-testid="install-prompt">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C4832A]">Get the app</p>
      <p className="mt-1 text-[17px] font-extrabold leading-tight text-[#F0E0C0]">Put MenRush on your Home Screen.</p>
      <p className="mt-1 text-[13px] leading-snug text-[#A89070]">{subtitle}</p>
      <div className="mt-3 flex gap-2.5">
        {androidChrome ? (
          <button
            type="button"
            onClick={installAndroid}
            data-testid="install-prompt-android"
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-[14px] font-bold text-[#FFF6E6]"
          >
            {deferred ? 'Install MenRush' : 'Install from Play'}
          </button>
        ) : deferred ? (
          <button
            type="button"
            onClick={() => void installPwa()}
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-[14px] font-bold text-[#FFF6E6]"
          >
            Install MenRush
          </button>
        ) : (
          <Link
            to="/get-the-app"
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-center text-[14px] font-bold text-[#FFF6E6]"
          >
            Show me how
          </Link>
        )}
        {!androidChrome || deferred ? null : (
          <Link
            to="/get-the-app"
            className="rounded-full border border-[rgba(196,131,42,0.35)] px-4 py-3 text-[14px] font-bold text-[#F0E0C0]"
          >
            How to
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
