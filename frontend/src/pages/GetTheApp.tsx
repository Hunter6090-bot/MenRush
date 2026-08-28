import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';
import { registerServiceWorker } from '../lib/push';

type Platform = 'ios' | 'android';

const IOS = [
  { t: 'Open Safari', d: 'Go to menrush.com in Safari. Not Chrome. Not Instagram\u2019s browser.' },
  { t: 'Tap Share', d: 'The square with the arrow pointing up. It\u2019s on the Safari bar.' },
  { t: 'Add to Home Screen', d: 'Scroll the list if you need to. Tap Add to Home Screen.' },
  { t: 'Tap Add', d: 'Leave the name as MenRush. Then open it from your Home Screen.' },
];

const ANDROID = [
  { t: 'Open Chrome', d: 'Go to menrush.com in Chrome.' },
  { t: 'Tap the three dots', d: 'Top-right of Chrome.' },
  { t: 'Install app', d: 'Tap Install app. If you only see Add to Home screen, use that.' },
  { t: 'Tap Install', d: 'Then open MenRush from your Home Screen.' },
];

function detectPlatform(): Platform {
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  return isAndroid && !isIOS ? 'android' : 'ios';
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

export function GetTheApp() {
  const [platform, setPlatform] = useState<Platform>('ios');
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  useEffect(() => {
    setPlatform(detectPlatform());
    void registerServiceWorker();
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const steps = platform === 'ios' ? IOS : ANDROID;
  const current = steps[step];
  const showSafariNote = platform === 'ios' && !isIosSafari() && !standalone;

  const tabClass = (active: boolean) =>
    active
      ? 'rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3 text-[15px] font-bold text-[#FFF6E6]'
      : 'rounded-full border border-[rgba(196,131,42,0.35)] px-4 py-3 text-[15px] font-bold text-[#F0E0C0]';

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step, steps.length]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0D0A06] text-[#F0E0C0]">
      <main className="mx-auto w-full max-w-[440px] flex-1 px-5 pb-12 pt-8">
        <Link to="/" className="text-xs font-bold uppercase tracking-[0.18em] text-[#A89070] hover:text-[#C4832A]">
          Back
        </Link>
        <img src="/brand/icon-512.png" alt="MenRush" width={96} height={96} className="mx-auto mt-6 h-24 w-24 rounded-full" />
        <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4832A]">Get the app</p>
        <h1 className="mt-3 text-center text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em]">Put MenRush on your phone.</h1>
        <p className="mt-3 text-center text-[15px] leading-[1.45] text-[#A89070]">Opens like an app. No store. No extra download.</p>
        <div className="mt-6 grid grid-cols-2 gap-2.5" role="tablist">
          <button type="button" className={tabClass(platform === 'ios')} onClick={() => { setPlatform('ios'); setStep(0); setDone(false); }}>iPhone</button>
          <button type="button" className={tabClass(platform === 'android')} onClick={() => { setPlatform('android'); setStep(0); setDone(false); }}>Android</button>
        </div>
        {showSafariNote ? (
          <p className="mt-4 rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.08)] px-3.5 py-3 text-[13px] leading-[1.45]">Use Safari on iPhone. Chrome cannot add MenRush to the Home Screen.</p>
        ) : null}
        {standalone ? (
          <p className="mt-4 rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.08)] px-3.5 py-3 text-[13px] leading-[1.45]">This already looks installed. If you opened it from the Home Screen, you\u2019re done.</p>
        ) : null}
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-[rgba(196,131,42,0.18)]" aria-hidden>
          <div className="h-full bg-gradient-to-r from-[#C4832A] to-[#E0A14A]" style={{ width: `${progress}%` }} />
        </div>
        {!done ? (
          <section className="mt-4 rounded-[22px] border border-[rgba(196,131,42,0.35)] bg-[rgba(20,14,8,0.72)] px-4 py-5">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#C4832A]">Step {step + 1} of {steps.length}</p>
            <h2 className="mt-2 text-[24px] font-extrabold leading-[1.15]">{current.t}</h2>
            <p className="mt-2 text-[15px] leading-[1.5] text-[#A89070]">{current.d}</p>
          </section>
        ) : (
          <section className="mt-4 text-center">
            <h2 className="text-[24px] font-extrabold">It\u2019s on your Home Screen.</h2>
            <p className="mt-2 text-[15px] text-[#A89070]">Open the MenRush icon. Sign in if you already have an invite.</p>
          </section>
        )}
        <div className="mt-4 flex gap-2.5">
          <button type="button" className="flex-1 rounded-full border border-[rgba(196,131,42,0.35)] px-4 py-3.5 text-[15px] font-bold text-[#F0E0C0] disabled:opacity-40" disabled={done || step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
          <button type="button" className="flex-1 rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3.5 text-[15px] font-bold text-[#FFF6E6]" onClick={() => { if (done) return; if (step < steps.length - 1) setStep((s) => s + 1); else setDone(true); }}>{done || step === steps.length - 1 ? 'Done' : 'Next'}</button>
        </div>
        {platform === 'android' && deferred ? (
          <button type="button" className="mt-3 w-full rounded-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-4 py-3.5 text-[15px] font-bold text-[#FFF6E6]" onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null); }}>Install MenRush</button>
        ) : null}
        <p className="mt-8 text-center text-[13px] leading-[1.5] text-[#6B5840]">No App Store. No Play Store.<br />18+ only. <Link to="/" className="font-bold text-[#C4832A]">Waitlist</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
