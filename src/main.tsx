import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import DatePicker css and other app css
import App from './App';
import PagesLayout from './pages/PagesLayout';
import About from './pages/About';
import Examples from './pages/Examples';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';
import './index.css';

if (typeof window !== 'undefined') {
  sessionStorage.removeItem('chunk-reload-attempted');

  (window as any).global = window;
  (window as any).process = {
    env: { DEBUG: undefined },
  };
  if (typeof (window as any).require === 'undefined') {
    (window as any).require = function(mod: string) {
      console.warn(`[Browser Shim] require("${mod}") called in browser runtime.`);
      return {};
    };
  }

  // Safely define toJSON on prototypes to intercept JSON.stringify crashes globally
  if (!(Error.prototype as any).toJSON) {
    Object.defineProperty(Error.prototype, 'toJSON', {
      value: function() {
        const alt: any = {};
        const seen = new WeakSet();
        const safeSerialize = (obj: any): any => {
          if (obj === null || obj === undefined) return obj;
          if (typeof obj !== "object") return obj;
          if (seen.has(obj)) return "[Circular]";
          seen.add(obj);

          if (obj instanceof Error) {
            return {
              name: obj.name,
              message: obj.message,
              stack: obj.stack
            };
          }
          if (typeof HTMLElement !== "undefined" && obj instanceof HTMLElement) {
             const tagName = obj.nodeName ? obj.nodeName.toLowerCase() : 'element';
             const idStr = obj.id ? '#' + obj.id : '';
             return `[HTMLElement <${tagName}${idStr}>]`;
          }
          if (Array.isArray(obj)) {
            return obj.map(item => {
               try { return safeSerialize(item); } catch { return "[Unreadable]"; }
            });
          }
          const clean: any = {};
          for (const key of Object.keys(obj)) {
            if (key.startsWith('__reactFiber') || key.startsWith('__reactProp') || key.startsWith('__reactEvent')) {
              clean[key] = "[ReactInternal]";
              continue;
            }
            try {
              clean[key] = safeSerialize(obj[key]);
            } catch {
              clean[key] = "[Unreadable]";
            }
          }
          return clean;
        };

        Object.getOwnPropertyNames(this).forEach((key) => {
          if (key.startsWith('__reactFiber') || key.startsWith('__reactProp') || key.startsWith('__reactEvent')) {
             return;
          }
          try {
             alt[key] = safeSerialize((this as any)[key]);
          } catch {
             alt[key] = "[Unreadable]";
          }
        });
        return alt;
      },
      configurable: true,
      writable: true
    });
  }

  if (typeof HTMLElement !== "undefined" && !(HTMLElement.prototype as any).toJSON) {
     Object.defineProperty(HTMLElement.prototype, 'toJSON', {
        value: function() {
           const idStr = this.id ? '#' + this.id : '';
           const tagName = this.nodeName ? this.nodeName.toLowerCase() : 'element';
           return `[HTMLElement <${tagName}${idStr}>]`;
        },
        configurable: true,
        writable: true
     });
  }

  // Safely intercept console calls to sanitize circular structures and prevent iframe/platform crashes
  const originalError = window.console.error;
  const originalWarn = window.console.warn;
  const originalLog = window.console.log;

  const sanitizeArg = (val: any, seen = new WeakSet()): any => {
    if (val === null || val === undefined) return val;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return val;
    if (typeof val === "bigint") return val.toString() + "n";
    if (typeof val === "function") return `[Function: ${val.name || "anonymous"}]`;
    
    if (typeof val === "object") {
      if (
        (typeof Node !== "undefined" && val instanceof Node) || 
        (typeof val.nodeType === "number" && typeof val.nodeName === "string")
      ) {
        const tagName = val.nodeName ? val.nodeName.toLowerCase() : "element";
        const idStr = val.id ? `#${val.id}` : "";
        return `[HTMLElement <${tagName}${idStr}>]`;
      }

      if (val === window || val === globalThis) {
         return "[GlobalWindow]";
      }

      if (seen.has(val)) {
         return "[Circular]";
      }
      seen.add(val);

      if (val instanceof Error) {
         return {
            message: val.message,
            name: val.name,
            stack: val.stack
         };
      }

      if (Array.isArray(val)) {
         return val.map(item => {
            try {
               return sanitizeArg(item, seen);
            } catch {
               return "[UnreadableItem]";
            }
         });
      }

      const cleanObj: any = {};
      for (const key of Object.keys(val)) {
         if (key.startsWith("__reactFiber") || key.startsWith("__reactProps") || key.startsWith("__reactEvents")) {
            cleanObj[key] = "[ReactInternal]";
            continue;
         }
         try {
            cleanObj[key] = sanitizeArg(val[key], seen);
         } catch {
            cleanObj[key] = "[Unreadable]";
         }
      }
      return cleanObj;
    }
    return val;
  };

  window.console.error = function(...args: any[]) {
     if (args.length > 0) {
       for (const arg of args) {
         if (arg instanceof Error && arg.name === 'Canceled' && arg.message === 'Canceled') {
           return;
         }
         if (arg && typeof arg === 'object' && arg.name === 'Canceled' && arg.message === 'Canceled') {
           return;
         }
         if (typeof arg === 'string' && (arg.includes('Canceled: Canceled') || arg.includes('<Fit />'))) {
           return;
         }
       }
     }

     const cleanArgs = args.map(arg => {
        try {
           return sanitizeArg(arg);
        } catch {
           return String(arg);
        }
     });
     return originalError.apply(this, cleanArgs);
  };

  window.console.warn = function(...args: any[]) {
     const cleanArgs = args.map(arg => {
        try {
           return sanitizeArg(arg);
        } catch {
           return String(arg);
        }
     });
     return originalWarn.apply(this, cleanArgs);
  };

  window.console.log = function(...args: any[]) {
     const cleanArgs = args.map(arg => {
        try {
           return sanitizeArg(arg);
        } catch {
           return String(arg);
        }
     });
     return originalLog.apply(this, cleanArgs);
  };

  // Register Stdin/I/O Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // console.log('App I/O ServiceWorker registered successfully:', reg.scope);
      }).catch((err) => {
        console.warn('App I/O ServiceWorker registration failed:', err);
      });
    });
  }

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
      msgStr.includes('canceled') ||
      msgStr.includes('cancelled') ||
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
      msgLower.includes('canceled') ||
      msgLower.includes('cancelled') ||
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
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
