import React, { useState, useEffect } from "react";
import { usePyPackageStore } from "../store/usePyPackageStore";
import { Search, Loader2, CheckCircle2, AlertCircle, Trash2, RefreshCw, Layers, ChevronDown, ChevronUp, Play, Check } from "lucide-react";

const sectionLabel =
  "text-[11px] font-semibold uppercase tracking-wide text-[var(--vsc-fg-muted,#616161)] mb-1.5";
const listBox =
  "border border-[var(--vsc-border,#e5e5e5)] rounded-[4px] overflow-hidden divide-y divide-[var(--vsc-border,#e5e5e5)]";
const iconBtn =
  "p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition disabled:opacity-50 cursor-pointer";

/** A settings row in the VS Code side bar idiom - no card, no fill. */
const ToggleRow: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}> = ({ checked, onChange, label, hint }) => (
  <label className="flex items-start gap-2 px-1 py-1.5 rounded-[3px] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] cursor-pointer transition-colors">
    <span className="relative flex items-center justify-center shrink-0 mt-px">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer appearance-none w-[14px] h-[14px] rounded-[2px] border border-[var(--vsc-border-strong,#cecece)] bg-[var(--vsc-input,#ffffff)] checked:bg-[var(--vsc-accent,#005fb8)] checked:border-[var(--vsc-accent,#005fb8)] focus:outline-none focus:ring-1 focus:ring-[var(--vsc-accent,#005fb8)] transition-colors cursor-pointer"
      />
      <Check
        className="absolute w-[10px] h-[10px] text-white pointer-events-none opacity-0 peer-checked:opacity-100"
        strokeWidth={3}
      />
    </span>
    <span className="min-w-0">
      <span className="block text-[12px] leading-tight">{label}</span>
      <span className="block text-[11px] text-[var(--vsc-fg-muted,#616161)] leading-snug mt-0.5">
        {hint}
      </span>
    </span>
  </label>
);

export const PyPackagesPanel: React.FC = () => {
  const installedPackages = usePyPackageStore((state) => state.installedPackages);
  const isLoadingRegistry = usePyPackageStore((state) => state.isLoadingRegistry);
  const activeInstallations = usePyPackageStore((state) => state.activeInstallations);
  const autoInstallMissing = usePyPackageStore((state) => state.autoInstallMissing);
  const pyPackageCacheEnabled = usePyPackageStore((state) => state.pyPackageCacheEnabled);
  const loadRegistry = usePyPackageStore((state) => state.loadRegistry);
  const installPackage = usePyPackageStore((state) => state.installPackage);
  const uninstallPackage = usePyPackageStore((state) => state.uninstallPackage);
  const setAutoInstallMissing = usePyPackageStore((state) => state.setAutoInstallMissing);
  const setPyPackageCacheEnabled = usePyPackageStore((state) => state.setPyPackageCacheEnabled);

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
    <div
      id="py-packages-panel"
      className="flex flex-col h-full bg-[var(--vsc-sidebar,#f8f8f8)] text-[var(--vsc-fg,#3b3b3b)] overflow-hidden select-none"
    >
      {/* Section header, matching the file explorer */}
      <div className="pl-4 pr-2 h-[26px] flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Layers className="w-3.5 h-3.5 shrink-0 text-[var(--vsc-fg-muted,#616161)]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wide truncate">
            Environment
          </h2>
        </div>
        <button
          onClick={() => loadRegistry()}
          disabled={isLoadingRegistry}
          className={iconBtn}
          title="Refresh Package Registry"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoadingRegistry ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Main scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 pb-3 space-y-4">
        {/* Auto install & cache settings */}
        <div>
          <ToggleRow
            checked={autoInstallMissing}
            onChange={setAutoInstallMissing}
            label="Auto-install imports"
            hint="Automatically pull packages from PyPI before execution."
          />
          <ToggleRow
            checked={pyPackageCacheEnabled}
            onChange={setPyPackageCacheEnabled}
            label="Persistent cache"
            hint="Cache wheel layers in IndexedDB for instant reload speeds."
          />
        </div>

        {/* Search / Install bar */}
        <div>
          <h3 className={sectionLabel}>Install custom package</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInstall(searchQuery);
              setSearchQuery("");
            }}
            className="flex gap-1.5"
          >
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--vsc-fg-muted,#616161)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. requests, plotly, numpy..."
                className="w-full text-xs pl-7 pr-2 py-1 rounded-[3px] border border-[var(--vsc-border-strong,#cecece)] bg-[var(--vsc-input,#ffffff)] text-[var(--vsc-fg,#3b3b3b)] placeholder-[var(--vsc-fg-muted,#616161)] focus:outline-none focus:ring-1 focus:ring-[var(--vsc-accent,#005fb8)] transition"
              />
            </div>
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="px-3 py-1 text-xs font-medium rounded-[3px] bg-[var(--vsc-accent,#005fb8)] text-[var(--vsc-accent-fg,#ffffff)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 cursor-pointer"
            >
              Install
            </button>
          </form>
        </div>

        {/* Active installations */}
        {Object.keys(activeInstallations).length > 0 && (
          <div>
            <h3 className={sectionLabel}>Active installations</h3>
            <div className="space-y-1.5">
              {Object.entries(activeInstallations).map(([name, info]) => (
                <div
                  key={name}
                  className={`p-2 rounded-[4px] border text-xs ${
                    info.status === "error"
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-[var(--vsc-border,#e5e5e5)] bg-[var(--vsc-input,#ffffff)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {info.status === "loading" ? (
                        <Loader2 className="w-3.5 h-3.5 text-[var(--vsc-accent,#005fb8)] animate-spin shrink-0" />
                      ) : info.status === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="truncate">{name}</span>
                    </div>
                    <button
                      onClick={() => toggleLogs(name)}
                      className="flex items-center gap-1 text-[10px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] px-1.5 py-0.5 rounded-[3px] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition shrink-0 cursor-pointer"
                    >
                      Logs
                      {expandedLogs[name] ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {expandedLogs[name] && (
                    <div className="mt-2 bg-[var(--vsc-editor,#ffffff)] border border-[var(--vsc-border,#e5e5e5)] text-[var(--vsc-fg-muted,#616161)] font-mono text-[10px] p-2 rounded-[3px] max-h-40 overflow-y-auto custom-scrollbar select-text leading-relaxed">
                      {info.progressLogs.map((log, idx) => (
                        <div key={idx} className="whitespace-pre-wrap">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Installed packages */}
        <div>
          <h3 className={sectionLabel}>
            Installed packages ({installedPackages.length})
          </h3>

          {installedPackages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center border border-dashed rounded-[4px] border-[var(--vsc-border,#e5e5e5)]">
              <Layers className="w-5 h-5 text-[var(--vsc-fg-muted,#616161)] opacity-50 mb-2" />
              <p className="text-xs">No packages installed</p>
              <p className="text-[11px] text-[var(--vsc-fg-muted,#616161)] mt-1 max-w-[190px] leading-snug">
                Search above, or pick one of the recommended libraries.
              </p>
            </div>
          ) : (
            <div className={listBox}>
              {installedPackages.map((pkg) => (
                <div
                  key={pkg.name}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition-colors group text-xs"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{pkg.name}</span>
                      {pkg.status === "installed" ? (
                        <span className="text-[10px] text-[var(--vsc-fg-muted,#616161)] shrink-0">
                          {pkg.version && pkg.version !== "loading"
                            ? `v${pkg.version}`
                            : "active"}
                        </span>
                      ) : pkg.status === "loading" ? (
                        <span className="px-1 text-[9px] font-medium rounded-[2px] bg-[var(--vsc-accent,#005fb8)] text-[var(--vsc-accent-fg,#ffffff)] shrink-0 animate-pulse">
                          Installing
                        </span>
                      ) : (
                        <span className="px-1 text-[9px] font-medium rounded-[2px] bg-red-500/15 text-red-500 shrink-0">
                          Error
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--vsc-fg-muted,#616161)] truncate">
                      Installed: {pkg.installedAt}
                    </span>
                  </div>

                  <div className="flex gap-0.5 items-center shrink-0">
                    {activeInstallations[pkg.name]?.progressLogs && (
                      <button
                        onClick={() => toggleLogs(pkg.name)}
                        className={iconBtn}
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
                          className="px-1.5 py-0.5 text-[10px] font-medium bg-red-600 hover:bg-red-700 text-white rounded-[3px] transition cursor-pointer"
                        >
                          Uninstall
                        </button>
                        <button
                          onClick={() => setConfirmUninstallPkg(null)}
                          className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] text-[var(--vsc-fg,#3b3b3b)] rounded-[3px] transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmUninstallPkg(pkg.name)}
                        className="p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-red-500 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
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

        {/* Recommended libraries */}
        {filteredRecommended.length > 0 && (
          <div>
            <h3 className={sectionLabel}>Recommended libraries</h3>
            <div className={listBox}>
              {filteredRecommended.map((pkg) => (
                <div
                  key={pkg.name}
                  onClick={() => handleInstall(pkg.name)}
                  className="group flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] cursor-pointer transition-colors text-xs"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{pkg.name}</span>
                    <span className="text-[11px] text-[var(--vsc-fg-muted,#616161)] truncate leading-snug">
                      {pkg.desc}
                    </span>
                  </div>
                  <button className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] text-[var(--vsc-fg,#3b3b3b)] group-hover:bg-[var(--vsc-accent,#005fb8)] group-hover:text-[var(--vsc-accent-fg,#ffffff)] group-hover:border-[var(--vsc-accent,#005fb8)] transition shrink-0 cursor-pointer">
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
