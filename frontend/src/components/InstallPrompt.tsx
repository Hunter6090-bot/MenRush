import { Link, useLocation } from 'react-router-dom';
import { isPhoneDevice } from '../lib/device';
import {
  clearDeferredInstallPrompt,
  useDeferredInstallPrompt,
} from '../lib/installPromptStore';
import { usePromptDismissal } from '../lib/promptDismissal';
import { usePromptSlot } from '../lib/promptSlot';
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
  // One "Don't show again" rule for every phone (owner ask, 10 Oct 2026).
  const dismissal = usePromptDismissal('install');

  // Never cover chat/room composers or Settings Sign out — sheet sits at z-60.
  const blocksChrome =
    location.pathname.startsWith('/messages') ||
    location.pathname.startsWith('/conversations') ||
    location.pathname.startsWith('/settings') ||
    /^\/rooms\/[^/]+/.test(location.pathname);

  // Worked out during render (not in an effect) so the prompt order knows on the
  // first paint whether the sheet wants to show.
  const eligible =
    typeof window !== 'undefined' &&
    isPhoneDevice() &&
    !isStandalone() &&
    location.pathname !== '/get-the-app' &&
    location.pathname !== '/install' &&
    !blocksChrome;

  // One prompt at a time: the Get the app sheet comes first, then alerts, then
  // Finish profile. The sign in page card has nothing to share the screen with.
  const wants = eligible && !dismissal.hidden;
  const onTop = usePromptSlot('install-sheet', variant === 'sheet' && wants ? 'want' : 'none');

  if (!wants || (variant === 'sheet' && !onTop)) return null;

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
      <p
        className="text-[15px] font-bold uppercase tracking-[0.12em] text-[var(--nn-accent-text)]"
        data-testid="install-prompt-label"
      >
        Get the app
      </p>
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
            data-testid="install-prompt-install"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[var(--copper)] px-4 py-3 text-[15px] font-bold text-[var(--nn-on-copper)]"
          >
            Install app
          </button>
        ) : (
          <Link
            to="/get-the-app"
            data-testid="install-prompt-how"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[var(--copper)] px-4 py-3 text-center text-[15px] font-bold text-[var(--nn-on-copper)]"
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
