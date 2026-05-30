import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import PagesLayout from './pages/PagesLayout';
import About from './pages/About';
import Examples from './pages/Examples';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import './index.css';

if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).process = {
    env: { DEBUG: undefined },
  };

  // Suppress ResizeObserver loop limit errors
  const resizeObserverError = 'ResizeObserver loop completed with undelivered notifications.';
  window.addEventListener('error', (e) => {
    if (e.message === resizeObserverError || e.message === 'ResizeObserver loop limit exceeded') {
      const resizeObserverDelegate = document.getElementById('webpack-dev-server-client-overlay') || 
                                     document.getElementById('vite-error-overlay');
      if (resizeObserverDelegate) {
        resizeObserverDelegate.style.display = 'none';
      }
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });

  // Also patch ResizeObserver to debounce slightly if possible, or just ignore
  const _ResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class ResizeObserver extends _ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          if (!Array.isArray(entries) || !entries.length) return;
          callback(entries, observer);
        });
      });
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route element={<PagesLayout />}>
          <Route path="/about" element={<About />} />
          <Route path="/examples" element={<Examples />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
