import { init } from '@telegram-apps/sdk-react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Guarded Telegram Apps SDK initialization
try {
  if (!(window as any).__PREVIEW__) {
    init();
  }
} catch (e) {
  console.warn('[@telegram-apps/sdk-react] init() skipped outside Telegram environment:', e);
}

// HashRouter guarantees seamless routing on GitHub Pages (/opendeck/),
// Telegram WebApp WebView and local preview without server rewrites or 404s.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

