import React from 'react';
import clsx from 'clsx';
import { ToggleSwitch } from '../../PanelPrimitives';

/**
 * Passport Studio design primitives. Every control in the studio is built from these so the
 * whole surface shares one accent (blue), one radius scale and one set of neutral tones.
 */

export const cx = clsx;

/* ---------- Surfaces ---------- */

export const SettingsCard: React.FC<{
  title: React.ReactNode;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ title, icon, aside, description, children, className }) => (
  <section className={cx(
    'rounded-xl border bg-white border-slate-200 dark:bg-[#161618] dark:border-white/[0.06]',
    className,
  )}>
    <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
      {icon && (
        <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-zinc-300">
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-zinc-100 truncate">{title}</h3>
        {description && <p className="text-[11px] leading-snug mt-0.5 text-slate-500 dark:text-zinc-500">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
    {children && <div className="px-4 pb-4 space-y-3.5">{children}</div>}
  </section>
);

/** Recessed inner block used for sub-options inside a card. */
export const Inset: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx(
    'rounded-lg border p-3 space-y-3 bg-slate-50 border-slate-200 dark:bg-black/20 dark:border-white/[0.06]',
    className,
  )}>
    {children}
  </div>
);

export const FieldLabel: React.FC<{ children: React.ReactNode; aside?: React.ReactNode; htmlFor?: string }> = ({ children, aside, htmlFor }) => (
  <div className="flex items-center justify-between gap-2 mb-1.5">
    <label htmlFor={htmlFor} className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">{children}</label>
    {aside}
  </div>
);

/** Small monospace read-out, e.g. "100%" or "300 DPI". */
export const ValueBadge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={cx(
    'inline-flex items-center font-mono text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md',
    'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-200',
    className,
  )}>
    {children}
  </span>
);

export const Hint: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cx('text-[11px] leading-snug text-slate-500 dark:text-zinc-500', className)}>{children}</p>
);

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500 border-transparent',
  accent: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15 dark:border-blue-500/25',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08] dark:border-white/[0.08]',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100',
  danger: 'bg-transparent text-slate-500 hover:bg-rose-50 hover:text-rose-600 border-transparent dark:text-zinc-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}> = ({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }) => (
  <button
    type={type}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors shrink-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
      'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
      size === 'sm' ? 'h-7 px-2.5 text-[11px]' : 'h-9 px-3 text-xs',
      buttonVariants[variant],
      className,
    )}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  size?: 'sm' | 'md';
}> = ({ active, size = 'md', className, children, type = 'button', ...rest }) => (
  <button
    type={type}
    aria-pressed={active}
    className={cx(
      'inline-flex items-center justify-center rounded-lg transition-colors shrink-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      size === 'sm' ? 'w-7 h-7' : 'w-9 h-9',
      active
        ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100',
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);

/* ---------- Selection controls ---------- */

export type SegmentOption<T> = { value: T; label: React.ReactNode; hint?: React.ReactNode; title?: string };

/** iOS-style segmented control: a recessed track with a raised active segment. */
export function Segmented<T extends string | number>({
  options, value, onChange, size = 'md', className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cx(
        'flex items-stretch p-0.5 rounded-lg gap-0.5 bg-slate-100 dark:bg-black/30 border border-slate-200/70 dark:border-white/[0.06]',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cx(
              'flex-1 min-w-0 flex flex-col items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.12] dark:text-white font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium',
            )}
          >
            <span className="flex items-center gap-1.5 truncate">{opt.label}</span>
            {opt.hint && (
              <span className={cx('text-[10px] font-normal truncate', active ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-400 dark:text-zinc-500')}>
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const Chip: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ active, onClick, children, title }) => (
  <button
    type="button"
    aria-pressed={active}
    title={title}
    onClick={onClick}
    className={cx(
      'h-7 px-2.5 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
      active
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-zinc-300 dark:hover:border-white/20 dark:hover:text-white',
    )}
  >
    {children}
  </button>
);

export const ChipRow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('flex flex-wrap gap-1.5', className)}>{children}</div>
);

export const Switch: React.FC<{ checked: boolean; onChange: (next: boolean) => void; title?: string }> = (props) => (
  <ToggleSwitch {...props} showState={false} />
);

/** Full-width clickable row with a label on the left and a switch on the right. */
export const SwitchRow: React.FC<{
  checked: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  title?: string;
}> = ({ checked, onToggle, icon, label, description, title }) => (
  <div
    role="button"
    tabIndex={0}
    title={title}
    onClick={onToggle}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-black/20 dark:border-white/[0.06] dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
  >
    {icon && <span className="text-slate-500 dark:text-zinc-400 shrink-0">{icon}</span>}
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-slate-800 dark:text-zinc-200">{label}</div>
      {description && <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">{description}</div>}
    </div>
    <Switch checked={checked} onChange={onToggle} />
  </div>
);

/* ---------- Inputs ---------- */

/**
 * Number field with an optional trailing unit. `onValueChange` receives the raw string so each
 * caller keeps its own parsing / clamping rules.
 */
export const NumberInput: React.FC<Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  onValueChange: (raw: string) => void;
  suffix?: React.ReactNode;
  inputClassName?: string;
}> = ({ onValueChange, suffix, className, inputClassName, ...rest }) => (
  <div className={cx(
    'flex items-center h-9 rounded-lg border transition-colors overflow-hidden',
    'bg-white border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20',
    'dark:bg-[#0E0E10] dark:border-white/[0.08] dark:focus-within:border-blue-500',
    className,
  )}>
    <input
      type="number"
      onChange={(e) => onValueChange(e.target.value)}
      className={cx(
        'flex-1 min-w-0 h-full bg-transparent px-2.5 text-xs font-mono tabular-nums outline-none',
        'text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600',
        inputClassName,
      )}
      {...rest}
    />
    {suffix && <span className="pr-2.5 pl-1 text-[11px] font-medium text-slate-400 dark:text-zinc-500 select-none">{suffix}</span>}
  </div>
);

export const Slider: React.FC<{
  label?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display?: React.ReactNode;
  className?: string;
}> = ({ label, value, min, max, step = 1, onChange, display, className }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={className}>
      {(label || display !== undefined) && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">{label}</span>
          <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-zinc-200">{display ?? value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right, var(--fill) 0 ${pct}%, var(--track) ${pct}% 100%)` }}
        className={cx(
          'w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none',
          '[--fill:#2563eb] [--track:#e2e8f0] dark:[--fill:#3b82f6] dark:[--track:rgba(255,255,255,0.1)]',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:shadow',
          '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white',
          '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-600',
          'focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-blue-500/30',
        )}
      />
    </div>
  );
};

export const Divider: React.FC<{ vertical?: boolean; className?: string }> = ({ vertical, className }) => (
  <div className={cx(
    'bg-slate-200 dark:bg-white/[0.08] shrink-0',
    vertical ? 'w-px h-5' : 'h-px w-full',
    className,
  )} />
);
