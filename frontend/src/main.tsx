import { init } from '@telegram-apps/sdk-react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Per tma-scaffold: init() MUST run exactly once, before any SDK hook is used.
// In design-preview (window.__PREVIEW__ set by preview.html) we skip it so the
// UI renders without a real Telegram bridge; sdk-react calls are guarded.
if (!(window as any).__PREVIEW__) {
  init();
}

// HashRouter for design-preview so deep links work from a static file path
// (/preview.html) without a server rewrite; BrowserRouter in production.
const Router = (window as any).__PREVIEW__ ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
);
