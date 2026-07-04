import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/menrush-tokens.css';
import 'leaflet/dist/leaflet.css';
import './styles/globals.css';
import App from './App';
import { initializeAnalytics } from './observability/analytics';
import { initializeErrorReporting, Sentry } from './observability/sentry';

initializeErrorReporting();
initializeAnalytics();

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
