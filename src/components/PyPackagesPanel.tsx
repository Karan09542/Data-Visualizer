import React, { useState, useEffect } from "react";
import { usePyPackageStore } from "../store/usePyPackageStore";
import { Search, Loader2, CheckCircle2, AlertCircle, Trash2, RefreshCw, Layers, ChevronDown, ChevronUp, Play } from "lucide-react";

export const PyPackagesPanel: React.FC = () => {
  const {
    installedPackages,
    isLoadingRegistry,
    activeInstallations,
    autoInstallMissing,
    pyPackageCacheEnabled,
    loadRegistry,
    installPackage,
    uninstallPackage,
    setAutoInstallMissing,
    setPyPackageCacheEnabled,
  } = usePyPackageStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [confirmUninstallPkg, setConfirmUninstallPkg] = useState<string | null>(null);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  const recommendedPackages = [
    { name: "numpy", desc: "Scientific computing, N-dimensional arrays" },
    { name: "pandas", desc: "Data manipulation and structure analysis" },
    { name: "matplotlib", desc: "Static, animated, and interactive plotting" },
    { name: "scipy", desc: "Mathematics, science, and engineering routines" },
    { name: "scikit-learn", desc: "Machine learning algorithms and workflows" },
    { name: "beautifulsoup4", desc: "Screen-scraping and parsing HTML/XML files" },
    { name: "sympy", desc: "Computer algebra and symbolic mathematics" },
    { name: "networkx", desc: "Creation and manipulation of complex graphs" },
  ];

  const handleInstall = async (name: string) => {
    if (!name.trim()) return;
    setExpandedLogs((prev) => ({ ...prev, [name.toLowerCase().trim()]: true }));
    await installPackage(name);
  };

  const handleUninstall = async (name: string) => {
    if (confirm(`Are you sure you want to uninstall package "${name}"?`)) {
      await uninstallPackage(name);
    }
  };

  const toggleLogs = (name: string) => {
    setExpandedLogs((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const filteredRecommended = recommendedPackages.filter(
    (pkg) =>
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !installedPackages.some((p) => p.name === pkg.name)
  );

  return (
    <div id="py-packages-panel" className="flex flex-col h-full bg-slate-50 dark:bg-[#0d1117] text-slate-800 dark:text-slate-100 overflow-hidden select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold tracking-wide">Environment</h2>
        </div>
        <button
          onClick={() => loadRegistry()}
          disabled={isLoadingRegistry}
          className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition disabled:opacity-50"
          title="Refresh Package Registry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRegistry ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* Auto install checkbox setting */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22]/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/20 cursor-pointer transition select-none">
            <input
              type="checkbox"
              checked={autoInstallMissing}
              onChange={(e) => setAutoInstallMissing(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Auto-install missing imports</p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">Automatically pull imports from PyPI before executing Python scripts.</p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22]/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/20 cursor-pointer transition select-none">
            <input
              type="checkbox"
              checked={pyPackageCacheEnabled}
              onChange={(e) => setPyPackageCacheEnabled(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Persistent package cache (Dexie.js)</p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">Cache and restore wheel files from IndexedDB instantly on next loads.</p>
            </div>
          </label>
        </div>

        {/* Search / Install Bar */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
            Install custom package
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInstall(searchQuery);
              setSearchQuery("");
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. requests, plotly, numpy..."
                className="w-full text-xs pl-8 pr-3 py-2 border rounded-md border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-slate-100 text-slate-900 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="px-3 py-2 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition shrink-0"
            >
              Install
            </button>
          </form>
        </div>

        {/* Active Installations or loading progress */}
        {Object.keys(activeInstallations).length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase block mb-1">
              Active Installations
            </h3>
            {Object.entries(activeInstallations).map(([name, info]) => (
              <div
                key={name}
                className={`p-3 rounded-lg border text-xs transition ${
                  info.status === "error"
                    ? "border-rose-100 bg-rose-50/20 dark:border-rose-900/40 dark:bg-rose-950/10"
                    : "border-emerald-100 bg-emerald-50/10 dark:border-emerald-900/30 dark:bg-emerald-950/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {info.status === "loading" ? (
                      <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                    ) : info.status === "success" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{name}</span>
                  </div>
                  <button
                    onClick={() => toggleLogs(name)}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Logs
                    {expandedLogs[name] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {expandedLogs[name] && (
                  <div className="mt-2.5 bg-slate-900 dark:bg-[#080c10] text-[#8b949e] font-mono text-[10px] p-2.5 rounded-md max-h-40 overflow-y-auto custom-scrollbar select-text leading-relaxed border border-slate-800">
                    {info.progressLogs.map((log, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Installed Packages List */}
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Installed Packages ({installedPackages.length})
            </h3>
          </div>

          {installedPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#161b22]/35">
              <Layers className="w-6 h-6 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">0 Packages Installed</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[180px]">
                Search or click on recommendations below to load packages in your workspace.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22]/70 overflow-hidden">
              {installedPackages.map((pkg) => (
                <div
                  key={pkg.name}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-[#1c2128]/45 transition group text-xs"
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate capitalize">
                        {pkg.name}
                      </span>
                      {pkg.status === "installed" ? (
                        <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 rounded-sm">
                          {pkg.version && pkg.version !== "loading" ? `v${pkg.version}` : "active"}
                        </span>
                      ) : pkg.status === "loading" ? (
                        <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-blue-500/10 text-blue-500 rounded-sm animate-pulse">
                          Installing
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-rose-500/10 text-rose-500 rounded-sm">
                          Error
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Installed: {pkg.installedAt}
                    </span>
                  </div>

                  <div className="flex gap-1 items-center shrink-0">
                    {activeInstallations[pkg.name]?.progressLogs && (
                      <button
                        onClick={() => toggleLogs(pkg.name)}
                        className="p-1 rounded text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Show Installation Logs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    
                    {confirmUninstallPkg === pkg.name ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={async () => {
                            await uninstallPackage(pkg.name);
                            setConfirmUninstallPkg(null);
                          }}
                          className="px-1.5 py-0.5 text-[10px] font-medium bg-rose-600 hover:bg-rose-500 text-white rounded transition"
                        >
                          Uninstall
                        </button>
                        <button
                          onClick={() => setConfirmUninstallPkg(null)}
                          className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmUninstallPkg(pkg.name)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                        title="Uninstall package"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggested precomputes */}
        {filteredRecommended.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Recommended Libraries
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {filteredRecommended.map((pkg) => (
                <div
                  key={pkg.name}
                  onClick={() => handleInstall(pkg.name)}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] hover:border-emerald-500/50 dark:hover:border-emerald-500/40 hover:shadow-sm cursor-pointer transition text-xs"
                >
                  <div className="flex flex-col pr-3">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-500 capitalize">
                      {pkg.name}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1 leading-normal">
                      {pkg.desc}
                    </span>
                  </div>
                  <button className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-300 group-hover:bg-emerald-600 group-hover:text-white transition shrink-0">
                    <Play className="w-2.5 h-2.5 fill-current" />
                    Load
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
