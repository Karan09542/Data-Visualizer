import React from 'react';
import { Download, X, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useModelDownload, formatModelSize } from '../../../../ai/hooks/useModelDownload';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';

interface Props {
  modelId: string | undefined;
  /** Shown above the button, e.g. "Background Removal". */
  label?: string;
  /** Rendered once the model is available locally. */
  children?: React.ReactNode;
  /** Called when a download finishes successfully. */
  onReady?: () => void;
  className?: string;
}

/**
 * Gates AI UI behind an explicit, cancellable model download.
 *
 * Before this, a missing model was fetched implicitly the first time a feature ran: there was no
 * way to see it coming, and no way to stop it once a 176 MB file was in flight.
 */
export const ModelDownloadGate: React.FC<Props> = ({ modelId, label, children, onReady, className = '' }) => {
  const { status, progress, error, sizeBytes, start, cancel } = useModelDownload(modelId);
  const manifest = modelId ? modelRegistry.get(modelId) : undefined;
  const name = manifest?.name || modelId || 'model';
  const sizeLabel = formatModelSize(sizeBytes);

  if (status === 'ready') return <>{children}</>;

  if (status === 'checking') {
    return (
      <div className={`flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-[#2D2D2D] bg-white dark:bg-[#1A1A1A] ${className}`}>
        <Loader2 size={13} className="animate-spin text-slate-400 shrink-0" />
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Checking model…</span>
      </div>
    );
  }

  if (status === 'downloading') {
    return (
      <div className={`p-2.5 rounded-xl border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/30 space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300 truncate">
              Downloading {name}
            </div>
            <div className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-mono tabular-nums">
              {progress}%{sizeLabel ? ` of ${sizeLabel}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={cancel}
            title="Cancel download"
            className="shrink-0 flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-bold border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition-colors touch-manipulation"
          >
            <X size={12} /> Cancel
          </button>
        </div>
        <div className="h-1.5 bg-blue-100 dark:bg-blue-500/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-200"
            style={{ width: `${Math.max(progress, 2)}%` }}
          />
        </div>
      </div>
    );
  }

  const isError = status === 'error';

  return (
    <div
      className={`p-2.5 rounded-xl border space-y-2 ${isError
        ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30'
        : 'border-slate-200 dark:border-[#2D2D2D] bg-white dark:bg-[#1A1A1A]'} ${className}`}
    >
      <div className="flex items-start gap-2">
        {isError
          ? <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          : <Download size={13} className="text-slate-400 shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          {label && (
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</div>
          )}
          <div className={`text-[11px] font-bold truncate ${isError ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>
            {name}
          </div>
          <div className={`text-[10px] leading-snug ${isError ? 'text-amber-700/80 dark:text-amber-400/80' : 'text-slate-500 dark:text-slate-400'}`}>
            {isError ? error : `Not downloaded yet${sizeLabel ? ` · ${sizeLabel}` : ''}. It is stored on this device afterwards.`}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { start().then(ok => { if (ok) onReady?.(); }); }}
        className="w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98] transition-colors touch-manipulation"
      >
        {isError ? <><RotateCcw size={13} /> Retry Download</> : <><Download size={13} /> Download Model</>}
      </button>
    </div>
  );
};
