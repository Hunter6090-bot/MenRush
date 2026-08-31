import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/menrush-tokens.css';
import './styles/globals.css';
import App from './App';
import { initializeErrorReporting, Sentry } from './observability/sentry';
import { initThemeFromStorage } from './lib/theme';
import { startInstallPromptCapture } from './lib/installPromptStore';

// Restore appearance before first paint of React tree (index.html also pre-applies).
initThemeFromStorage();

// Capture beforeinstallprompt as early as possible so navigation does not drop it.
startInstallPromptCapture();

// Sentry stays eager (tree-shaken ~87KB chunk). Statsig boots on idle so phones
// do not pay for analytics on first paint of every route.
initializeErrorReporting();
const bootAnalytics = () => {
  void import('./observability/analytics')
    .then((m) => m.initializeAnalytics())
    .catch(() => undefined);
};
const ric = (
  window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }
).requestIdleCallback;
if (typeof ric === 'function') ric(bootAnalytics, { timeout: 3500 });
else window.setTimeout(bootAnalytics, 1);

const errorFallback = (
  <div style={{ background: '#0D0A06', color: '#C4832A', padding: '2rem', fontFamily: 'monospace', minHeight: '100vh' }}>
    <h1 style={{ marginBottom: '1rem' }}>Something went wrong</h1>
    <p style={{ color: '#F0E0C0' }}>Please reload and try again.</p>
    {import.meta.env.DEV && (
      <p style={{ color: '#A89070', fontSize: '0.75rem', marginTop: '1rem' }}>
        Check the browser console for details.
      </p>
    )}
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={errorFallback}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
