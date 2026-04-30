import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles/globals.css';
import App from './App';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ background: '#0D0A06', color: '#C4832A', padding: '2rem', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h1 style={{ marginBottom: '1rem' }}>Runtime Error</h1>
          <pre style={{ color: '#F0E0C0', marginBottom: '1rem' }}>{err.message}</pre>
          <pre style={{ color: '#F0E0C0', fontSize: '0.75rem', opacity: 0.6 }}>{err.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
