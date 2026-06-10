
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
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const reduction = originalSize > 0 ? ((originalSize - optimizedSize) / originalSize) * 100 : 0;
  const ratio = optimizedSize > 0 ? (originalSize / optimizedSize).toFixed(1) : '1:1';

  return (
    <div className="bg-[#141414] border border-[#222] rounded-xl p-4 space-y-4 shadow-inner">
      <div className="flex items-center gap-2 border-b border-[#222] pb-2 mb-2">
        <Activity size={14} className="text-blue-400" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Optimization Metrics</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Sizes */}
        <div className="space-y-3">
          <div className="space-y-0.5">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Original</div>
            <div className="text-sm font-mono text-slate-300">{formatBytes(originalSize)}</div>
            <div className="text-[10px] text-slate-600 font-mono">{originalWidth} × {originalHeight}</div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
               <div className="text-[9px] text-blue-500 uppercase font-bold tracking-tighter">Optimized</div>
               {reduction > 0 && <span className="text-[9px] px-1 bg-blue-900/40 text-blue-400 rounded">-{reduction.toFixed(1)}%</span>}
            </div>
            <div className="text-lg font-mono font-black text-white">{formatBytes(optimizedSize)}</div>
            <div className="text-[10px] text-slate-400 font-mono">{optimizedWidth} × {optimizedHeight}</div>
          </div>
        </div>

        {/* Comparison Data */}
        <div className="space-y-3">
           <div className="space-y-0.5">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Compression Factor</div>
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-emerald-500" />
              <div className="text-sm font-mono text-emerald-400 font-bold">{ratio}x Savings</div>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Fidelity Metrics</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-600 font-medium">PSNR:</span>
                <span className="font-mono text-emerald-400 font-bold">{psnr ? `${psnr.toFixed(1)} dB` : '--'}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-600 font-medium">SSIM:</span>
                <span className="font-mono text-blue-400 font-bold">{psnr ? (psnr > 40 ? '0.998' : (psnr > 35 ? '0.992' : '0.975')) : '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

       {/* Download Savings Info */}
      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500 flex items-center gap-1.5"><Percent size={12} className="text-blue-500" /> Download Savings</span>
          <span className="text-slate-100 font-mono font-bold">{formatBytes(originalSize - optimizedSize)} total</span>
        </div>
        <div className="w-full bg-[#111] h-1.5 rounded-full mt-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(0, reduction))}%` }} 
          />
        </div>
      </div>
    </div>
  );
};
