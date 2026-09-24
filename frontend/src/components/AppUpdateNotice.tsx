import { useEffect, useState } from 'react';

/** Detect a newer deployment without reloading a form, chat draft or active call. */
export function AppUpdateNotice({
  buildId = import.meta.env.VITE_APP_BUILD_ID,
  enabled = import.meta.env.PROD,
}: { buildId?: string; enabled?: boolean }) {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled || !buildId || dismissed) return;
    let stopped = false;
    let pending = false;
    const controller = new AbortController();
    const check = async () => {
      if (document.visibilityState === 'hidden' || pending) return;
      pending = true;
      try {
        const response = await fetch(`/app-version.json?t=${Date.now()}`, {
          cache: 'no-store', signal: controller.signal, credentials: 'omit',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!stopped && typeof data.buildId === 'string' && data.buildId !== buildId) setAvailable(true);
      } catch { /* Offline / old deployment: keep the current session intact. */ }
      finally { pending = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 5 * 60 * 1000);
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [buildId, enabled, dismissed]);

  if (!available || dismissed) return null;
  return (
    <aside aria-label="App update" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[300] mx-auto max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-[var(--cream)] shadow-xl">
      <p role="status" className="text-sm">An update is ready. Save your changes and finish any call before refreshing.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className="min-h-11 flex-1 rounded-xl border border-[var(--copper)] px-3" onClick={() => {
          if (window.confirm('Refresh MenRush now? Unsaved changes, drafts and active calls will be lost.')) window.location.reload();
        }}>Refresh</button>
        <button type="button" className="min-h-11 flex-1 rounded-xl border border-[var(--border-default)] px-3" onClick={() => setDismissed(true)}>Later</button>
      </div>
    </aside>
  );
}
