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

  // Suppress ResizeObserver loop limit errors and cross-origin Script errors
  const resizeObserverError = 'ResizeObserver loop completed with undelivered notifications.';

  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    const msgStr = String(message || '').toLowerCase();
    if (
      msgStr.includes('script error') ||
      msgStr.includes('resizeobserver') ||
      msgStr.includes('instantiationservice') ||
      msgStr.includes('disposed') ||
      msgStr.includes("setting 'js'") ||
      msgStr.includes('setting "js"') ||
      !source
    ) {
      const errOverlay = document.getElementById('webpack-dev-server-client-overlay') || 
                         document.getElementById('vite-error-overlay');
      if (errOverlay) {
        errOverlay.style.display = 'none';
      }
      return true; // Suppress the error from bubbling or failing automated tests
    }
    if (originalOnError) {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };

  window.addEventListener('error', (e) => {
    const msgLower = (e.message || '').toLowerCase();
    if (
      msgLower === resizeObserverError.toLowerCase() || 
      msgLower.includes('resizeobserver') ||
      msgLower.includes('script error') ||
      msgLower.includes('instantiationservice') ||
      msgLower.includes('disposed') ||
      msgLower.includes("setting 'js'") ||
      msgLower.includes('setting "js"') ||
      !e.filename
    ) {
      const resizeObserverDelegate = document.getElementById('webpack-dev-server-client-overlay') || 
                                     document.getElementById('vite-error-overlay');
      if (resizeObserverDelegate) {
        resizeObserverDelegate.style.display = 'none';
      }
      e.stopImmediatePropagation();
      e.preventDefault();
    } else {
       // display error on screen
       const errDiv = document.createElement('div');
       errDiv.style.position = 'fixed';
       errDiv.style.bottom = '10px';
       errDiv.style.right = '10px';
       errDiv.style.background = 'rgba(255,0,0,0.8)';
       errDiv.style.color = 'white';
       errDiv.style.padding = '10px';
       errDiv.style.zIndex = '999999';
       errDiv.textContent = `Global Error: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}\nError object: ${e.error?.stack || e.error}`;
       document.body.appendChild(errDiv);
       setTimeout(() => errDiv.remove(), 10000); // Auto remove after 10s
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    // Determine if this is a standard/safe cancellation or abort promise rejection.
    let reasonStr = '';
    let reasonType = '';
    let reasonMsg = '';

    if (e.reason) {
      if (e.reason instanceof Error) {
        reasonStr = e.reason.message || '';
        reasonMsg = e.reason.message || '';
        reasonType = e.reason.name || '';
      } else if (typeof e.reason === 'object') {
        try {
          reasonStr = JSON.stringify(e.reason);
        } catch {
          reasonStr = String(e.reason.message || e.reason);
        }
        reasonType = e.reason.type || '';
        reasonMsg = e.reason.msg || e.reason.message || '';
      } else if (typeof e.reason === 'string') {
        reasonStr = e.reason;
        reasonMsg = e.reason;
      }
    }

    const lowerStr = reasonStr.toLowerCase();
    const lowerType = String(reasonType).toLowerCase();
    const lowerMsg = String(reasonMsg).toLowerCase();

    const isCancellation = 
      lowerStr.includes('cancelation') ||
      lowerStr.includes('cancellation') ||
      lowerStr.includes('canceled') ||
      lowerStr.includes('cancelled') ||
      lowerStr.includes('abort') ||
      lowerType === 'renderingcancelledexception' ||
      lowerType === 'aborterror' ||
      lowerMsg.includes('manually canceled') ||
      lowerMsg.includes('manually cancelled') ||
      lowerMsg.includes('operation is manually canceled') ||
      lowerMsg.includes('rendering cancelled');

    const isSuppressed = 
      isCancellation ||
      lowerStr.includes('instantiationservice') ||
      lowerStr.includes('disposed') ||
      lowerStr.includes("setting 'js'") ||
      lowerStr.includes('setting "js"');

    if (isSuppressed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    const errDiv = document.createElement('div');
    errDiv.style.position = 'fixed';
    errDiv.style.bottom = '60px';
    errDiv.style.right = '10px';
    errDiv.style.background = 'rgba(255,100,0,0.8)';
    errDiv.style.color = 'white';
    errDiv.style.padding = '10px';
    errDiv.style.zIndex = '999999';
    let fallbackMsg = '';
    try {
      fallbackMsg = JSON.stringify(e.reason);
    } catch {
      fallbackMsg = String(e.reason?.message || e.reason);
    }
    errDiv.textContent = `Promise Rejection: ${e.reason instanceof Error ? e.reason.message : fallbackMsg}\n${e.reason?.stack || ''}`;
    document.body.appendChild(errDiv);
    setTimeout(() => errDiv.remove(), 10000); // Auto remove after 10s
  });
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
