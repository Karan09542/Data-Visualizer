import React from 'react';
import { CloudOff, RefreshCw, RotateCcw, WifiOff } from 'lucide-react';
import { describeLoadFailure, humanizeFeatureName, isLoadFailure, isOffline, notifyLoadFailure } from '../utils/offlineErrors';

interface Props {
  /** Shown to the user, e.g. "Properties" or "ImportModal" (split into words). */
  name?: string;
  /** Called before a retry so the next render starts a fresh download. */
  onRetry: () => void;
  /** Read at render time, so a retry renders whatever `onRetry` put in place. */
  render: () => React.ReactNode;
}

interface State {
  error: unknown;
  isLoadFailure: boolean;
  offline: boolean;
  attempts: number;
}

/**
 * Catches a lazily loaded part of the app that could not be downloaded, and says why - with a way
 * to try again - instead of the failure unmounting everything above it.
 *
 * Only download failures are handled here. Any other error is thrown on to the next boundary up,
 * so real bugs are reported exactly as before.
 */
export class ModuleLoadBoundary extends React.Component<Props, State> {
  state: State = { error: null, isLoadFailure: false, offline: isOffline(), attempts: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    // Decided once, here: whether a network error counts depends on being offline, which can
    // change before the next render.
    return { error, isLoadFailure: isLoadFailure(error), offline: isOffline() };
  }

  componentDidCatch(error: unknown) {
    // Also as a toast: a lazily loaded dialog or overlay may sit somewhere the inline message
    // cannot be seen.
    if (isLoadFailure(error)) notifyLoadFailure(humanizeFeatureName(this.props.name));
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  // Getting the connection back is exactly when a retry can succeed, so it happens unasked.
  private handleOnline = () => {
    if (this.state.error) this.retry();
    else this.setState({ offline: false });
  };

  private handleOffline = () => this.setState({ offline: true });

  private retry = () => {
    this.props.onRetry();
    this.setState(s => ({ error: null, isLoadFailure: false, offline: isOffline(), attempts: s.attempts + 1 }));
  };

  render() {
    const { error, offline, attempts } = this.state;
    if (!error) return this.props.render();
    if (!this.state.isLoadFailure) throw error;

    const { title, message } = describeLoadFailure(humanizeFeatureName(this.props.name), offline);
    const Icon = offline ? WifiOff : CloudOff;

    return (
      <div role="alert" className="w-full h-full min-h-[140px] flex items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col items-center text-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#161a22]/95 px-5 py-5 shadow-sm">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <Icon size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-colors"
            >
              <RefreshCw size={12} />
              Try again
            </button>
            {/* Browsers may remember a failed module download for the life of the page; a reload
                is the sure way past that once the connection is back. */}
            {!offline && attempts > 0 && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={12} />
                Reload app
              </button>
            )}
          </div>
          {offline && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500">It will try again by itself when you’re back online.</p>
          )}
        </div>
      </div>
    );
  }
}
