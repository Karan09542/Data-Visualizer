import React, { useState } from "react";
import { usePyPackageStore } from "../store/usePyPackageStore";
import { useStore } from "../store/useStore";
import { executePyNode } from "../utils/pyExecutor";
import { AlertTriangle, Loader2, Play, CheckCircle2, X } from "lucide-react";

export const PyMissingPromptModal: React.FC = () => {
  const showMissingModal = usePyPackageStore((state) => state.showMissingModal);
  const setShowMissingModal = usePyPackageStore((state) => state.setShowMissingModal);
  const installPackage = usePyPackageStore((state) => state.installPackage);
  const store = useStore();

  const [installing, setInstalling] = useState(false);
  const [currentInstallingPkg, setCurrentInstallingPkg] = useState("");
  const [completedPkgs, setCompletedPkgs] = useState<string[]>([]);
  const [errorPkg, setErrorPkg] = useState("");

  if (!showMissingModal || !showMissingModal.isOpen) return null;

  const { path, missingPackages } = showMissingModal;

  const handleInstallAndRun = async () => {
    setInstalling(true);
    setErrorPkg("");
    setCompletedPkgs([]);

    for (const pkg of missingPackages) {
      setCurrentInstallingPkg(pkg);
      const success = await installPackage(pkg, path);
      if (!success) {
        setErrorPkg(pkg);
        setInstalling(false);
        return;
      }
      setCompletedPkgs((prev) => [...prev, pkg]);
    }

    // Success! Automatically run the code and close modal
    let activeCodeValue = store.jsNodeCodeOverrides[path];
    if (activeCodeValue === undefined) {
      // Fallback to value from parsedData
      const getValueByPath = (parsedData: any, path: string): string => {
        if (!parsedData || !path) return "";
        const parts = path.replace(/root\.?/, "").split(/\.|(?=\[)/).filter(Boolean);
        let current = parsedData;
        for (let i = 0; i < parts.length; i++) {
          if (current === undefined || current === null) return "";
          let part = parts[i];
          if (part.startsWith("[")) {
            part = part.slice(1, -1);
          }
          current = current[part];
        }
        return typeof current === "string" ? current : "";
      };
      activeCodeValue = getValueByPath(store.parsedData, path);
    }
    
    executePyNode(path, activeCodeValue || "");
    
    // Close modal
    setShowMissingModal(null);
    setInstalling(false);
  };

  const handleClose = () => {
    setShowMissingModal(null);
  };

  return (
    <div id="py-missing-prompt-modal" className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 flex items-center justify-center p-4 z-[9999] animate-fade-in backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transform scale-95 transition-all text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Missing Libraries</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs select-none">
          {!installing ? (
            <>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                We detected that your Python script imports packages not currently installed in the environment:
              </p>
              <div className="flex flex-wrap gap-1.5 py-1">
                {missingPackages.map((pkg) => (
                  <span
                    key={pkg}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded border border-amber-500/20 capitalize font-mono"
                  >
                    {pkg}
                  </span>
                ))}
              </div>
              {errorPkg && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 font-medium">
                  Failed to install package "{errorPkg}". Please make sure it is a valid Python package name.
                </div>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Would you like to install these packages first? They will be persisted for subsequent runs.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  Installing libraries...
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic block">
                  Processing package "{currentInstallingPkg}" from PyPI
                </p>
              </div>

              {/* Progress feedback */}
              <div className="w-full text-left space-y-1 bg-slate-50 dark:bg-[#0d1117] p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {missingPackages.map((pkg) => (
                  <div key={pkg} className="flex items-center gap-1.5 capitalize">
                    {completedPkgs.includes(pkg) ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    ) : currentInstallingPkg === pkg ? (
                      <Loader2 className="w-3 h-3 text-emerald-500 animate-spin shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                    )}
                    <span>{pkg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22]/50">
          <button
            onClick={handleClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
          >
            Back
          </button>
          {!installing && (
            <button
              onClick={handleInstallAndRun}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 hover:shadow-sm transition"
            >
              <Play className="w-3 h-3 fill-current" />
              Install & Run
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
