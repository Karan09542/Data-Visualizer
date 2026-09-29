import React from 'react';
import { Camera, Moon, Printer, Sun, Upload, UserSquare2, X } from 'lucide-react';
import type { ExportFormat } from '../types';
import { Button, Divider, IconButton } from '../ui/primitives';
import { ExportMenu } from './ExportMenu';

export const StudioHeader: React.FC<{
  isDark: boolean;
  printDPI: number;
  exportFormat: ExportFormat;
  onToggleTheme: () => void;
  onOpenCamera: () => void;
  onUpload: () => void;
  onExport: (format: ExportFormat) => void;
  onPrint: () => void;
  onClose: () => void;
  /** More buttons beside Export (e.g. Add to canvas). */
  extraActions?: React.ReactNode;
}> = ({ isDark, printDPI, exportFormat, onToggleTheme, onOpenCamera, onUpload, onExport, onPrint, onClose, extraActions }) => (
  <header className="h-14 shrink-0 z-40 relative flex items-center gap-2 px-3 sm:px-4 border-b bg-white border-slate-200 dark:bg-[#111113] dark:border-white/[0.06]">
    {/* Brand */}
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shrink-0">
        <UserSquare2 size={17} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight truncate text-slate-900 dark:text-zinc-100">Passport Studio</h1>
          <span className="hidden md:inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400">
            {printDPI} DPI
          </span>
        </div>
        <p className="hidden lg:block text-[11px] truncate text-slate-500 dark:text-zinc-500">
          Passport photo generator & print sheet layout
        </p>
      </div>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      <Button variant="ghost" onClick={onOpenCamera} title="Snap new photo with camera" icon={<Camera size={15} />} className="px-2 sm:px-3">
        <span className="hidden md:inline">Camera</span>
      </Button>
      <Button variant="ghost" onClick={onUpload} title="Upload photo from device" icon={<Upload size={15} />} className="px-2 sm:px-3">
        <span className="hidden md:inline">Upload</span>
      </Button>

      <IconButton onClick={onToggleTheme} title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}>
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </IconButton>

      <Divider vertical className="mx-0.5 hidden sm:block" />

      {extraActions}
      <ExportMenu format={exportFormat} onExport={onExport} />

      <Button variant="primary" onClick={onPrint} title="Print or Save PDF" icon={<Printer size={15} />} className="px-2.5 sm:px-3.5">
        <span className="hidden sm:inline">Print / PDF</span>
      </Button>

      <IconButton onClick={onClose} title="Close Passport Studio">
        <X size={18} />
      </IconButton>
    </div>
  </header>
);
