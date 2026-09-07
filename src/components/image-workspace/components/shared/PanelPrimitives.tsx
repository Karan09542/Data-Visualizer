import React from 'react';
import { ColorPickerTrigger } from './ColorPickers';

/**
 * Shared building blocks for the right-hand property panels. These live here rather than inside
 * PropertiesTab so every panel in the inspector reads as one design system.
 */

export const PanelSection: React.FC<{
   title: React.ReactNode;
   icon?: React.ReactNode;
   children: React.ReactNode;
   className?: string;
}> = ({ title, icon, children, className = '' }) => (
   <div className={`bg-white dark:bg-[#181818] rounded-xl border border-slate-200 dark:border-[#2A2A2A] p-4 space-y-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-900 dark:text-white tracking-wide uppercase">
         {icon}
         <span className="flex-1 min-w-0">{title}</span>
      </div>
      {children}
   </div>
);

export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
   <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500 block mb-1.5">{children}</span>
);

export const RangeSlider: React.FC<
   React.InputHTMLAttributes<HTMLInputElement> & { label?: string; valueDisplay?: string | number; displayUnit?: string }
> = ({ label, valueDisplay, displayUnit = '', ...props }) => (
   <div>
      {(label || valueDisplay !== undefined) && (
         <div className="flex justify-between items-center text-[10px] text-slate-600 dark:text-zinc-400 mb-1.5 font-medium">
            {label && <span>{label}</span>}
            {valueDisplay !== undefined && (
               <span className="font-mono text-slate-800 dark:text-white/90 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                  {valueDisplay}{displayUnit}
               </span>
            )}
         </div>
      )}
      <input
         type="range"
         {...props}
         className={`w-full accent-blue-500 hover:accent-blue-400 h-1.5 bg-slate-200 dark:bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer ${props.className || ''}`}
      />
   </div>
);

export const GridButton: React.FC<{
   active?: boolean;
   onClick: () => void;
   children: React.ReactNode;
   className?: string;
   title?: string;
}> = ({ active, onClick, children, className = '', title }) => (
   <button
      type="button"
      onClick={onClick}
      title={title}
      className={`py-1.5 text-[10px] font-semibold rounded-md transition-all active:scale-95 ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'} ${className}`}
   >
      {children}
   </button>
);

/** Swatch plus hex readout. Fills the row width, which a bare 32px swatch does not. */
export const ColorField: React.FC<{
   label: string;
   color: string;
   muted?: boolean;
   onChange: (c: string) => void;
}> = ({ label, color, muted, onChange }) => (
   <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-500/50 transition-colors">
         <div
            className="w-6 h-6 rounded-md shrink-0 border border-black/10 dark:border-white/20 shadow-inner relative overflow-hidden"
            style={{ backgroundColor: muted ? 'transparent' : color }}
         >
            <ColorPickerTrigger color={color} onChange={onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
         </div>
         <span className="font-mono text-[10px] uppercase text-slate-600 dark:text-zinc-400 truncate">{muted ? 'none' : color}</span>
      </div>
   </div>
);

/** Segmented none / solid / dashed picker with a real line preview above each label. */
export const BorderStylePicker: React.FC<{
   value: string;
   onChange: (style: 'none' | 'solid' | 'dashed') => void;
}> = ({ value, onChange }) => (
   <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5 rounded-lg p-1">
      {([
         { id: 'none', preview: 'border-transparent' },
         { id: 'solid', preview: 'border-solid' },
         { id: 'dashed', preview: 'border-dashed' },
      ] as const).map((st) => (
         <GridButton
            key={st.id}
            active={value === st.id}
            onClick={() => onChange(st.id)}
            className="flex flex-col items-center gap-1.5 py-2"
         >
            <span className={`block w-7 border-t-2 border-current ${st.preview}`} />
            <span className="capitalize">{st.id}</span>
         </GridButton>
      ))}
   </div>
);
