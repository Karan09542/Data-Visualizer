import { create } from "zustand";
import { getInstalledPackages, saveInstalledPackage, removeInstalledPackage, PyPackageMetadata } from "../utils/pyDb";
import { useStore } from "./useStore";
import { appendLogs } from "../utils/executionStore";

export interface PyPackageStore {
  installedPackages: PyPackageMetadata[];
  isLoadingRegistry: boolean;
  activeInstallations: Record<string, { status: "loading" | "success" | "error"; progressLogs: string[] }>;
  autoInstallMissing: boolean;
  pyPackageCacheEnabled: boolean;
  showMissingModal: {
    isOpen: boolean;
    path: string;
    missingPackages: string[];
  } | null;
  
  loadRegistry: () => Promise<void>;
  installPackage: (name: string, targetPath?: string) => Promise<boolean>;
  uninstallPackage: (name: string, targetPath?: string) => Promise<void>;
  setAutoInstallMissing: (val: boolean) => void;
  setPyPackageCacheEnabled: (val: boolean) => void;
  setShowMissingModal: (val: { isOpen: boolean; path: string; missingPackages: string[] } | null) => void;
}

// Spawns a temporary worker specifically for running a package installation if no worker exists
async function runWorkerInstall(
  packageName: string, 
  onLog: (msg: string) => void, 
  onError: (err: string) => void
): Promise<{ success: boolean; version: string; error?: string }> {
  const { activePyWorkers, SHARED_KEY } = await import("../utils/pyExecutor");
  let worker = activePyWorkers[SHARED_KEY];
  if (!worker) {
    worker = new Worker(new URL("../utils/pyWorker.ts", import.meta.url), { type: "module" });
    activePyWorkers[SHARED_KEY] = worker;
  }

  return new Promise((resolve) => {
    const installId = Math.random().toString(36).substring(7);
    
    const timer = setTimeout(() => {
      cleanup();
      onError(`Installation timed out for ${packageName}`);
      resolve({ success: false, version: "", error: "Timeout" });
    }, 90000); // 90 second timeout for installation

    const messageHandler = (e: MessageEvent) => {
      if (e.data.type === "logs") {
        for (const log of e.data.logs) {
          const rawText = log.args?.join(" ") || "";
          onLog(rawText);
        }
      } else if (e.data.type === "package_installed" && e.data.installId === installId) {
        cleanup();
        resolve({
          success: e.data.success,
          version: e.data.version || "latest",
          error: e.data.error
        });
      }
    };

    const errorHandler = (e: ErrorEvent) => {
      cleanup();
      onError(e.message || "Failed to execute install worker");
      resolve({ success: false, version: "", error: e.message });
    };

    function cleanup() {
      clearTimeout(timer);
      if (worker) {
        worker.removeEventListener("message", messageHandler);
        worker.removeEventListener("error", errorHandler);
      }
    }

    worker.addEventListener("message", messageHandler);
    worker.addEventListener("error", errorHandler);

    worker.postMessage({ 
      type: "install_package", 
      packageName, 
      installId,
      cacheEnabled: usePyPackageStore.getState().pyPackageCacheEnabled
    });
  });
}

export const usePyPackageStore = create<PyPackageStore>((set, get) => ({
  installedPackages: [],
  isLoadingRegistry: false,
  activeInstallations: {},
  autoInstallMissing: (() => {
    try {
      return localStorage.getItem("py_auto_install_missing") === "true";
    } catch {
      return false;
    }
  })(),
  pyPackageCacheEnabled: (() => {
    try {
      return localStorage.getItem("py_package_cache_enabled") !== "false";
    } catch {
      return true;
    }
  })(),
  showMissingModal: null,

  loadRegistry: async () => {
    set({ isLoadingRegistry: true });
    try {
      const pkgs = await getInstalledPackages();
      set({ installedPackages: pkgs });
    } catch (e) {
      console.error("Error loading packages from DB:", e);
    } finally {
      set({ isLoadingRegistry: false });
    }
  },

  setAutoInstallMissing: (val: boolean) => {
    try {
      localStorage.setItem("py_auto_install_missing", String(val));
    } catch {}
    set({ autoInstallMissing: val });
  },

  setPyPackageCacheEnabled: (val: boolean) => {
    try {
      localStorage.setItem("py_package_cache_enabled", String(val));
    } catch {}
    set({ pyPackageCacheEnabled: val });
  },

  setShowMissingModal: (val) => {
    set({ showMissingModal: val });
  },

  installPackage: async (name: string, targetPath?: string) => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) return false;

    // Check if progress is already loading
    const currentActive = get().activeInstallations[cleanName];
    if (currentActive?.status === "loading") {
      return false;
    }

    set((state) => ({
      activeInstallations: {
        ...state.activeInstallations,
        [cleanName]: { status: "loading", progressLogs: ["Checking dependencies...", "Spawning runtime container..."] }
      }
    }));

    // Update DB with loading state
    await saveInstalledPackage({
      name: cleanName,
      version: "loading",
      installedAt: new Date().toLocaleDateString(),
      status: "loading"
    });
    await get().loadRegistry();

    // Logger helpers
    const handleLog = async (msg: string) => {
      set((state) => {
        const prevLogs = state.activeInstallations[cleanName]?.progressLogs || [];
        return {
          activeInstallations: {
            ...state.activeInstallations,
            [cleanName]: { status: "loading", progressLogs: [...prevLogs, msg] }
          }
        };
      });

      // If there is an active workspace path, run standard appendLogs to show logs in the console terminal!
      if (targetPath) {
        appendLogs(targetPath, [
          {
            type: "log",
            args: [msg],
            time: new Date().toISOString()
          }
        ]).catch(() => {});
      }
    };

    const handleError = async (err: string) => {
      set((state) => {
        const prevLogs = state.activeInstallations[cleanName]?.progressLogs || [];
        return {
          activeInstallations: {
            ...state.activeInstallations,
            [cleanName]: { status: "error", progressLogs: [...prevLogs, `✖ Error: ${err}`] }
          }
        };
      });

      if (targetPath) {
        appendLogs(targetPath, [
          {
            type: "error",
            args: [`Installation of package "${cleanName}" failed: ${err}`],
            time: new Date().toISOString()
          }
        ]).catch(() => {});
      }
    };

    const result = await runWorkerInstall(cleanName, handleLog, handleError);

    if (result.success) {
      set((state) => ({
        activeInstallations: {
          ...state.activeInstallations,
          [cleanName]: {
            status: "success",
            progressLogs: [...(state.activeInstallations[cleanName]?.progressLogs || []), "✔ Package installed successfully."]
          }
        }
      }));

      // Update package database entry
      await saveInstalledPackage({
        name: cleanName,
        version: result.version || "latest",
        installedAt: new Date().toLocaleDateString(),
        status: "installed"
      });

      await get().loadRegistry();
      return true;
    } else {
      set((state) => ({
        activeInstallations: {
          ...state.activeInstallations,
          [cleanName]: {
            status: "error",
            progressLogs: [...(state.activeInstallations[cleanName]?.progressLogs || []), `✖ Installation failed: ${result.error}`]
          }
        }
      }));

      await saveInstalledPackage({
        name: cleanName,
        version: "failed",
        installedAt: new Date().toLocaleDateString(),
        status: "error"
      });
      await get().loadRegistry();
      return false;
    }
  },

  uninstallPackage: async (name: string, targetPath?: string) => {
    const cleanName = name.trim().toLowerCase();
    await removeInstalledPackage(cleanName);
    
    // Clear active installations logs and immediately remove package from list
    set((state) => {
      const copy = { ...state.activeInstallations };
      delete copy[cleanName];
      const filtered = state.installedPackages.filter((p) => p.name !== cleanName);
      return { 
        activeInstallations: copy,
        installedPackages: filtered
      };
    });

    if (targetPath) {
      appendLogs(targetPath, [
        {
          type: "warn",
          args: [`[Pyodide Package Manager]: Uninstalled package "${cleanName}". Environment will be refreshed on next execution.`],
          time: new Date().toISOString()
        }
      ]).catch(() => {});
    }

    // Since unloading Python modules is unstable, we clear and terminate the shared worker so on next execute it builds a clean workspace!
    const activePyWorkers = (await import("../utils/pyExecutor")).activePyWorkers;
    const activePyRejectors = (await import("../utils/pyExecutor")).activePyRejectors;
    const currentExecutingPath = (await import("../utils/pyExecutor")).currentExecutingPath;
    const SHARED_KEY = "shared_global_python_worker";
    
    const worker = activePyWorkers[SHARED_KEY];
    if (worker) {
      worker.terminate();
      delete activePyWorkers[SHARED_KEY];
      const activePyWorkersBusy = (await import("../utils/pyExecutor")).activePyWorkersBusy;
      delete activePyWorkersBusy[SHARED_KEY];

      if (currentExecutingPath && activePyRejectors[currentExecutingPath]) {
        activePyRejectors[currentExecutingPath](new Error("Runtime restarted to apply package removal"));
        delete activePyRejectors[currentExecutingPath];
      }
    }

    await get().loadRegistry();
  }
}));
