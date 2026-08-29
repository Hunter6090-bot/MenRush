import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { registerServiceWorker } from '../lib/push';
import { getInstallPlatform, isStandaloneDisplay } from '../lib/pwaInstall';
import { trackEvent, trackEventOnce } from '../observability/analytics';

const DISMISS_KEY = 'menrush_install_prompt_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIos() {
  return getInstallPlatform() === 'ios';
}

export function InstallPrompt({ variant }: { variant: 'card' | 'sheet' }) {
  const location = useLocation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const surface = variant === 'card' ? 'login_card' : 'post_login_sheet';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneDisplay()) return;
    if (location.pathname === '/get-the-app' || location.pathname === '/install') return;
    if (variant === 'sheet' && localStorage.getItem(DISMISS_KEY) === '1') return;

    setHidden(false);
    trackEventOnce(
      'install_prompt_shown',
      { platform: getInstallPlatform(), surface },
      `install_prompt_shown_${surface}`,
    );
    void registerServiceWorker();
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      trackEventOnce(
        'install_native_available',
        { platform: getInstallPlatform(), surface },
        `install_native_available_${surface}`,
      );
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [location.pathname, variant, surface]);

  if (hidden) return null;

  const hide = (trackDismiss: boolean) => {
    localStorage.setItem(DISMISS_KEY, '1');
    if (trackDismiss) {
      trackEvent('install_prompt_dismissed', { platform: getInstallPlatform(), surface });
    }
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    trackEvent('install_cta_clicked', {
      platform: getInstallPlatform(),
      surface,
      method: 'native',
    });
    await deferred.prompt();
    const choice = await deferred.userChoice;
    trackEvent('install_native_outcome', {
      platform: getInstallPlatform(),
      surface,
      outcome: choice.outcome,
    });
    if (choice.outcome === 'accepted') {
      trackEventOnce(
        'install_success',
        { platform: getInstallPlatform(), method: 'native', source: 'user_choice', surface },
        'install_success',
      );
    }
    setDeferred(null);
    hide(choice.outcome !== 'accepted');
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
        {deferred ? (
          <button
            type="button"
            onClick={() => void install()}
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-[14px] font-bold text-[#FFF6E6]"
          >
            Install MenRush
          </button>
        ) : (
          <Link
            to="/get-the-app"
            onClick={() =>
              trackEvent('install_cta_clicked', {
                platform: getInstallPlatform(),
                surface,
                method: 'guide',
              })
            }
            className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-center text-[14px] font-bold text-[#FFF6E6]"
          >
            Show me how
          </Link>
        )}
        <button
          type="button"
          onClick={() => hide(true)}
          className="rounded-full border border-[rgba(196,131,42,0.35)] px-4 py-3 text-[14px] font-bold text-[#F0E0C0]"
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
