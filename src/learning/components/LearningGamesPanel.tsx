import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { AlertTriangle, CheckCircle2, CloudOff, GraduationCap, HardDrive, Info, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "../../store/useStore";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useLearningStore } from "../store/useLearningStore";
import type { LearningView } from "../types";
import { CreateGameView } from "./CreateGameView";
import { FlowStepper } from "./FlowStepper";
import { PlayView } from "./PlayView";
import { ResultsView } from "./ResultsView";
import { ReviewView } from "./ReviewView";
import { WordsView } from "./WordsView";
import { ConfirmContext, type ConfirmRequest } from "./primitives";
import { useMediaQuery } from "./hooks";
import "../learning.css";

const VIEWS: Record<LearningView, () => React.ReactElement> = {
  words: WordsView,
  create: CreateGameView,
  play: PlayView,
  results: ResultsView,
  review: ReviewView,
};

export default function LearningGamesPanel() {
  const open = useStore((s) => s.isLearningGamesOpen);
  const setOpen = useStore((s) => s.setIsLearningGamesOpen);
  const status = useLearningStore((s) => s.status);
  const view = useLearningStore((s) => s.view);
  const active = useLearningStore((s) => s.active);
  const historyCount = useLearningStore((s) => s.history.length);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [confirm, setConfirm] = useState<(ConfirmRequest & { resolve: (ok: boolean) => void }) | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    void useLearningStore.getState().flush();
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    void useLearningStore.getState().init();
    useStore.getState().setIsMobileMenuOpen(false);
    return () => {
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const ask = useCallback(
    (req: ConfirmRequest) => new Promise<boolean>((resolve) => setConfirm({ ...req, resolve })),
    [],
  );
  const answer = (ok: boolean) => {
    confirm?.resolve(ok);
    setConfirm(null);
  };

  const available = useMemo<Record<LearningView, boolean>>(
    () => ({ words: true, create: true, play: !!active, results: historyCount > 0, review: historyCount > 0 }),
    [active, historyCount],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Typing here must not reach the canvas shortcuts (undo, drawing toggle) behind the panel.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      if (confirm) answer(false);
      else close();
    } else if (e.key === "Tab") {
      trapFocus(e, panelRef.current);
    }
  };

  const View = VIEWS[view];
  const playing = view === "play";
  // On phones the board needs every row it can get, so the title row folds away while playing.
  const compact = !isDesktop && playing && status === "ready";

  return (
    <ConfirmContext.Provider value={ask}>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[9000]" onKeyDown={onKeyDown}>
            <motion.div
              className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px] dark:bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              aria-hidden
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="lg-title"
              tabIndex={-1}
              className={cn(
                "absolute flex flex-col overflow-hidden bg-white text-slate-800 shadow-2xl outline-none dark:bg-[#0d1117] dark:text-slate-200",
                isDesktop
                  ? "bottom-2 right-2 top-2 rounded-3xl border border-slate-200/80 transition-[width] duration-300 ease-out dark:border-slate-800"
                  : "inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))] rounded-t-[1.75rem]",
              )}
              style={isDesktop ? { width: playing ? "min(1120px, calc(100vw - 1rem))" : "min(540px, calc(100vw - 1rem))" } : undefined}
              initial={isDesktop ? { x: "105%" } : { y: "100%" }}
              animate={isDesktop ? { x: 0 } : { y: 0 }}
              exit={isDesktop ? { x: "105%" } : { y: "100%" }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 34, stiffness: 340, mass: 0.9 }}
              drag={isDesktop ? false : "y"}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 140 || info.velocity.y > 700) close();
              }}
              onAnimationComplete={() => {
                if (open && !panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true });
              }}
            >
              <header
                className="shrink-0 border-b border-slate-200/80 px-4 pb-2 pt-2 dark:border-slate-800 sm:px-5 md:pt-4"
                onPointerDown={(e) => {
                  // The header doubles as the sheet's drag handle on phones.
                  if (!isDesktop && !(e.target as HTMLElement).closest("button")) dragControls.start(e);
                }}
                style={!isDesktop ? { touchAction: "none" } : undefined}
              >
                {!isDesktop && <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden />}
                <div className={cn("mb-2 flex items-center gap-3", compact && "sr-only")}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30">
                    <GraduationCap size={21} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h1 id="lg-title" className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
                      Learning Games
                    </h1>
                    <SaveStatus />
                  </div>
                  {!compact && (
                    <button
                      type="button"
                      onClick={close}
                      aria-label="Close Learning Games"
                      className="flex size-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
                {status === "ready" && (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <FlowStepper view={view} available={available} wide={isDesktop} onChange={(v) => useLearningStore.getState().setView(v)} />
                    </div>
                    {compact && (
                      <button
                        type="button"
                        onClick={close}
                        aria-label="Close Learning Games"
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                )}
              </header>

              <main className="relative min-h-0 flex-1">
                {status !== "ready" ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-7 animate-spin text-slate-400" aria-label="Loading your words" />
                  </div>
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={view}
                      className="absolute inset-0"
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                    >
                      <View />
                    </motion.div>
                  </AnimatePresence>
                )}
                <NoticeToast />
              </main>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText ?? "Confirm"}
        variant={confirm?.variant ?? "danger"}
        onConfirm={() => answer(true)}
        onClose={() => answer(false)}
      />
    </ConfirmContext.Provider>
  );
}

/** Keeps Tab and Shift+Tab inside the panel while it is open. */
function trapFocus(e: React.KeyboardEvent, root: HTMLElement | null) {
  if (!root || e.defaultPrevented) return;
  const focusable = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
    (el) => el.offsetParent !== null,
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function SaveStatus() {
  const kind = useLearningStore((s) => s.storageKind);
  const saveStatus = useLearningStore((s) => s.saveStatus);
  let icon = <HardDrive size={12} />;
  let text = "Saved on this device";
  if (!kind) text = "Opening your words…";
  else if (kind === "memory") {
    icon = <CloudOff size={12} />;
    text = "Storage unavailable: progress lasts until you close this tab";
  } else if (saveStatus === "saving") text = "Saving…";
  else if (saveStatus === "error") {
    icon = <AlertTriangle size={12} />;
    text = "Couldn't save the latest change";
  }
  return (
    <p
      className={cn(
        "flex items-center gap-1 truncate text-xs",
        kind === "memory" || saveStatus === "error" ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400",
      )}
      title={kind ? `Stored with ${kind === "opfs" ? "the Origin Private File System" : kind === "indexeddb" ? "IndexedDB" : "memory only"}` : undefined}
    >
      {icon}
      <span className="truncate">{text}</span>
    </p>
  );
}

function NoticeToast() {
  const notice = useLearningStore((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => useLearningStore.getState().dismissNotice(), notice.tone === "error" ? 6000 : 3200);
    return () => window.clearTimeout(t);
  }, [notice]);

  const Icon = notice?.tone === "success" ? CheckCircle2 : notice?.tone === "error" ? AlertTriangle : Info;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg",
              notice.tone === "error" ? "bg-rose-600 text-white" : "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
            )}
          >
            <Icon size={16} className="shrink-0" />
            {notice.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
