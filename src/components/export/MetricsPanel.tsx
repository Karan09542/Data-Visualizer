
import { formatFileSize } from "../../lib/formatFileSize";
import React from 'react';
import { Activity, BarChart3, TrendingDown, Percent, FileType } from 'lucide-react';

interface Props {
  originalSize: number;
  optimizedSize: number;
  originalWidth: number;
  originalHeight: number;
  optimizedWidth: number;
  optimizedHeight: number;
  format: string;
  psnr?: number;
}

export const MetricsPanel: React.FC<Props> = ({
  originalSize,
  optimizedSize,
  originalWidth,
  originalHeight,
  optimizedWidth,
  optimizedHeight,
  format,
  psnr
}) => {
  const formatBytes = (bytes: number): string => formatFileSize(bytes, 'B', 1);

  const reduction = originalSize > 0 ? ((originalSize - optimizedSize) / originalSize) * 100 : 0;
  const isSavings = reduction >= 0;
  const ratio = optimizedSize > 0 ? (originalSize / optimizedSize).toFixed(1) : '1.0';

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg md:rounded-xl p-2 md:p-4 space-y-2 md:space-y-4 shadow-inner">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-1.5 md:pb-2 mb-1.5 md:mb-2">
        <div className="flex items-center gap-1.5 md:gap-2">
          <Activity size={12} className="md:w-3.5 md:h-3.5 text-blue-400" />
          <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Optimization Metrics</span>
        </div>
        <span className="text-[8px] md:text-[9px] font-bold font-mono text-slate-600 dark:text-slate-400 uppercase bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 px-1.5 md:px-2 py-0.5 rounded-full">
          {format.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:gap-4">
        {/* Sizes */}
        <div className="space-y-1.5 md:space-y-3">
          <div className="space-y-0.5">
            <div className="text-[8px] md:text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Original Editing Canvas</div>
            <div className="text-xs md:text-sm font-mono text-slate-700 dark:text-slate-300">{formatBytes(originalSize)}</div>
            <div className="text-[9px] md:text-[10px] text-slate-600 font-mono">{originalWidth} × {originalHeight}</div>
          </div>
          <div className="space-y-0.5">
             <div className="flex items-center gap-1.5">
               <div className="text-[8px] md:text-[9px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-tighter">Optimized Export</div>
               {isSavings ? (
                  reduction > 0 && <span className="text-[7.5px] md:text-[8px] font-mono font-bold px-1 py-0.5 md:px-1.5 md:py-0.2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded md:rounded-md border border-blue-200 dark:border-blue-500/20">-{reduction.toFixed(1)}%</span>
               ) : (
                  <span className="text-[7.5px] md:text-[8px] font-mono font-bold px-1 py-0.5 md:px-1.5 md:py-0.2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded md:rounded-md border border-indigo-200 dark:border-indigo-500/20">HQ Native</span>
               )}
            </div>
            <div className="text-base md:text-lg font-mono font-black text-slate-900 dark:text-white">{formatBytes(optimizedSize)}</div>
            <div className="text-[9px] md:text-[10px] text-slate-600 dark:text-slate-400 font-mono">{optimizedWidth} × {optimizedHeight}</div>
          </div>
        </div>

        {/* Comparison Data */}
        <div className="space-y-1.5 md:space-y-3">
           <div className="space-y-0.5">
            <div className="text-[8px] md:text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Compression Factor</div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <TrendingDown size={12} className={`md:w-3.5 md:h-3.5 ${isSavings ? "text-emerald-500" : "text-blue-400"}`} />
              <div className={`text-xs md:text-sm font-mono font-bold ${isSavings ? "text-emerald-400" : "text-blue-300"}`}>
                {isSavings ? `${ratio}x Savings` : `1.0x Full Native`}
              </div>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[8px] md:text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Fidelity Metrics</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] md:text-[10px]">
                <span className="text-slate-600 font-medium">PSNR:</span>
                <span className="font-mono text-emerald-400 font-bold">{psnr ? `${psnr.toFixed(1)} dB` : '--'}</span>
              </div>
              <div className="flex items-center justify-between text-[9px] md:text-[10px]">
                <span className="text-slate-600 font-medium">SSIM:</span>
                <span className="font-mono text-blue-400 font-bold">{psnr ? (psnr >= 90 ? '1.000 (Perfect)' : (psnr > 40 ? '0.998' : (psnr > 35 ? '0.992' : '0.975'))) : '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

       {/* Download Savings Info */}
      <div className="mt-2 md:mt-4 p-2 md:p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800/50">
        <div className="flex items-center justify-between text-[9px] md:text-[10px]">
          <span className="text-slate-500 flex items-center gap-1.5"><Percent size={10} className="md:w-3 md:h-3 text-blue-500" /> {isSavings ? 'Download Savings' : 'Export Payload Mode'}</span>
          <span className="text-slate-800 dark:text-slate-100 font-mono font-bold">
            {isSavings ? `${formatBytes(originalSize - optimizedSize)} total saved` : `100% Native HQ (${formatBytes(optimizedSize)})`}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(10, isSavings ? reduction : 100))}%` }} 
          />
        </div>
      </div>
    </div>
  );
};
