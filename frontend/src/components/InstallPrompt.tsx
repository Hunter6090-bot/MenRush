import { Link, useLocation } from 'react-router-dom';
import { isPhoneDevice } from '../lib/device';
import {
  clearDeferredInstallPrompt,
  useDeferredInstallPrompt,
} from '../lib/installPromptStore';
import { useEffect, useState } from 'react';
import { usePromptDismissal } from '../lib/promptDismissal';
import { PromptDismissControls } from './PromptDismissControls';

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
  // One "Don't remind me again" rule for every phone (owner ask, 10 Oct 2026).
  const dismissal = usePromptDismissal('install');

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
    setHidden(false);
  }, [location.pathname, variant, blocksChrome]);

  if (hidden || blocksChrome || dismissal.hidden) return null;

  // Android Chrome can one-tap install when we still hold the deferred event.
  // iPhone / Safari cannot — keep Show me how. Android without a prompt falls
  // back to the Chrome-menu how-to (in-app browser, criteria not met, etc.).
  const canNativeInstall = Boolean(deferred) && !isIos();

  const install = async () => {
    if (!deferred || isIos()) return;
    await deferred.prompt();
    await deferred.userChoice;
    clearDeferredInstallPrompt();
    dismissal.close(true);
  };

  const wrap =
    variant === 'sheet'
      ? // Sits on top of the phone tab bar, never over it (tab bar is fixed bottom-0, z-50,
        // and already pads the home-indicator safe area).
        'fixed inset-x-0 bottom-[var(--mobile-tab-bar-height)] z-[60] border-y border-[var(--border-default)] bg-[var(--bg-card)] px-4 pb-4 pt-4'
      : 'mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-4';

  return (
    <aside className={wrap} role="dialog" aria-label="Install MenRush">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--nn-accent-text)]">Get the app</p>
      <p className="mt-1 text-[17px] font-extrabold leading-tight text-[var(--cream)]">Put MenRush on your Home Screen.</p>
      <p className="mt-1 text-[15px] leading-snug text-[var(--cream-muted)]">
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
      </div>
      <PromptDismissControls
        onClose={dismissal.close}
        closeLabel="Close get the app"
        testIdPrefix="install-prompt"
        className="mt-2"
      />
    </aside>
  );
}
