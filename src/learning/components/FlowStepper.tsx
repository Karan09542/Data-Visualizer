import { BookOpenText, ChevronRight, Grid3x3, ListChecks, Trophy, Wand2 } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { LearningView } from "../types";

const STEPS: { id: LearningView; label: string; icon: typeof BookOpenText }[] = [
  { id: "words", label: "My Words", icon: BookOpenText },
  { id: "create", label: "Create", icon: Wand2 },
  { id: "play", label: "Play", icon: Grid3x3 },
  { id: "results", label: "Results", icon: Trophy },
  { id: "review", label: "Review", icon: ListChecks },
];

interface FlowStepperProps {
  view: LearningView;
  available: Record<LearningView, boolean>;
  onChange: (view: LearningView) => void;
  /** Show every label; otherwise only the current step's, to fit narrow screens. */
  wide: boolean;
}

/** My Words → Create → Play → Results → Review, as navigation. */
export function FlowStepper({ view, available, onChange, wide }: FlowStepperProps) {
  return (
    <nav aria-label="Learning steps" className="-mx-1 overflow-x-auto px-1 no-scrollbar">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const current = step.id === view;
          const enabled = available[step.id] || current;
          const Icon = step.icon;
          return (
            <Fragment key={step.id}>
              {i > 0 && <ChevronRight aria-hidden size={13} className="shrink-0 text-slate-300 dark:text-slate-600" />}
              <li className={cn(current && !wide && "min-w-0 flex-1")}>
                <button
                  type="button"
                  disabled={!enabled}
                  aria-current={current ? "step" : undefined}
                  aria-label={step.label}
                  title={step.label}
                  onClick={() => onChange(step.id)}
                  className={cn(
                    "flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    current
                      ? "w-full justify-center bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                    "disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:disabled:text-slate-600",
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {(wide || current) && <span className="truncate">{step.label}</span>}
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
