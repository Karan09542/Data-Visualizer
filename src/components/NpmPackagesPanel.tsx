import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { copyToClipboard } from "./AppErrorPopup";
import {
  cachedNpmPackages,
  clearNpmPackages,
  downloadNpmPackage,
  fetchNpmInfo,
  importSnippets,
  listNpmPackages,
  npmStorageInfo,
  removeNpmPackage,
  searchNpm,
  subscribeNpmPackages,
  type NpmPackageInfo,
  type NpmPackageRecord,
  type NpmSearchResult,
} from "../utils/npmPackages";

const sectionLabel =
  "text-[11px] font-semibold uppercase tracking-wide text-[var(--vsc-fg-muted,#616161)] mb-1.5";
const listBox =
  "border border-[var(--vsc-border,#e5e5e5)] rounded-[4px] overflow-hidden divide-y divide-[var(--vsc-border,#e5e5e5)]";
const iconBtn =
  "p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition disabled:opacity-50 cursor-pointer";
const codeBox =
  "font-mono text-[11px] leading-relaxed bg-[var(--vsc-editor,#ffffff)] border border-[var(--vsc-border,#e5e5e5)] rounded-[3px] text-[var(--vsc-fg,#3b3b3b)]";
const linkClass = "inline-flex items-center gap-0.5 text-[var(--vsc-accent,#005fb8)] hover:underline underline-offset-2";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** Accepts what people paste: "npm i lodash", "yarn add zod", or just the name. */
const cleanPackageName = (text: string) =>
  text.trim().replace(/^(npm|yarn|pnpm|bun)\s+(i|install|add)\s+/i, "").split(/\s+/)[0] || "";

const npmUrl = (name: string) => {
  const parts = name.split("/");
  const base = (name.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]).replace(/(.)@.*$/, "$1");
  return `https://www.npmjs.com/package/${base}`;
};

/** A line of code with a copy button. */
const CopyLine: React.FC<{ text: string; note?: string }> = ({ text, note }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`${codeBox} flex items-center justify-between gap-2 pl-2 pr-1 py-1`}>
      <code className="truncate select-text" title={text}>
        {text}
        {note && <span className="text-[var(--vsc-fg-muted,#616161)]">{"  // " + note}</span>}
      </code>
      <button
        type="button"
        className={iconBtn}
        title="Copy"
        onClick={async () => {
          if (await copyToClipboard(text)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
};

const USAGE_EXAMPLES: [string, string][] = [
  ['import _ from "lodash";', "default export"],
  ['import { z } from "zod";', "named exports"],
  ['import * as dateFns from "date-fns";', "everything"],
  ['import get from "lodash/get";', "a subpath"],
  ['import dayjs from "dayjs@1.11";', "pin a version"],
  ['const axios = require("axios");', "require works too"],
];

/** Whether the reader last opened or closed "How to use"; null if they never touched it. */
const USAGE_PREFERENCE_KEY = "npm_panel_usage_open";

const readUsagePreference = (): boolean | null => {
  try {
    const value = localStorage.getItem(USAGE_PREFERENCE_KEY);
    return value === null ? null : value === "true";
  } catch {
    return null;
  }
};

export const NpmPackagesPanel: React.FC = () => {
  // null until the first read of the device list; the last read is used when there was one.
  const [packages, setPackages] = useState<NpmPackageRecord[] | null>(() => cachedNpmPackages());
  const [storage, setStorage] = useState<{ bytes: number; backend: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUsage, setShowUsage] = useState<boolean | null>(readUsagePreference);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NpmSearchResult[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [infos, setInfos] = useState<Record<string, NpmPackageInfo | null | "loading">>({});
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, info] = await Promise.all([listNpmPackages(), npmStorageInfo().catch(() => null)]);
      setPackages(list);
      setStorage(info);
    } finally {
      setLoading(false);
    }
  }, []);

  // Live: runs add packages, other editors remove them.
  useEffect(() => {
    void refresh();
    return subscribeNpmPackages(() => void refresh());
  }, [refresh]);

  // The usage guide is open while there is nothing to list, unless the reader has chosen. It is
  // not shown at all until the list has been read: deciding on the empty initial list opened it,
  // and the saved packages arriving a moment later closed it again.
  const usageKnown = showUsage !== null || packages !== null;
  const usageOpen = showUsage ?? packages?.length === 0;
  const toggleUsage = () => {
    const next = !usageOpen;
    setShowUsage(next);
    try {
      localStorage.setItem(USAGE_PREFERENCE_KEY, String(next));
    } catch {
      // Not remembered; it still toggles.
    }
  };

  // npm matches for the download box, after a short pause in typing.
  useEffect(() => {
    const name = cleanPackageName(query);
    if (name.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => setSuggestions(await searchNpm(name)), 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Details from npm when a row is opened.
  useEffect(() => {
    if (!expanded || infos[expanded] !== undefined) return;
    setInfos((prev) => ({ ...prev, [expanded]: "loading" }));
    void fetchNpmInfo(expanded).then((info) => setInfos((prev) => ({ ...prev, [expanded]: info })));
  }, [expanded, infos]);

  const download = async (raw: string) => {
    const name = cleanPackageName(raw);
    if (!name || downloading) return;
    setSuggestOpen(false);
    setDownloading(name);
    setMessage(null);
    const error = await downloadNpmPackage(name);
    setDownloading(null);
    if (error) {
      setMessage({ type: "error", text: error });
    } else {
      setQuery("");
      setMessage({ type: "success", text: `"${name}" is saved on this device, with its editor types.` });
      setExpanded(name);
    }
    void refresh();
  };

  const remove = async (name: string) => {
    setRemoving(name);
    await removeNpmPackage(name);
    setRemoving(null);
    setConfirmRemove(null);
    if (expanded === name) setExpanded(null);
    void refresh();
  };

  return (
    <div
      id="npm-packages-panel"
      className="flex flex-col h-full bg-[var(--vsc-sidebar,#f8f8f8)] text-[var(--vsc-fg,#3b3b3b)] overflow-hidden select-none"
    >
      {/* Section header, matching the file explorer */}
      <div className="pl-4 pr-2 h-[26px] flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Package className="w-3.5 h-3.5 shrink-0 text-[var(--vsc-fg-muted,#616161)]" />
          <h2 className="text-[11px] font-bold uppercase tracking-wide truncate">npm packages</h2>
        </div>
        <button onClick={() => refresh()} disabled={loading} className={iconBtn} title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 pb-3 space-y-4">
        {/* How to use */}
        {usageKnown && (
        <div>
          <button
            type="button"
            onClick={toggleUsage}
            className="w-full flex items-center gap-1 text-left cursor-pointer"
          >
            {usageOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span className={`${sectionLabel} mb-0`}>How to use</span>
          </button>
          {usageOpen && (
            <div className="mt-1.5 space-y-2 text-[11px] leading-snug text-[var(--vsc-fg-muted,#616161)]">
              <p>
                Import a package by its <span className="text-[var(--vsc-fg,#3b3b3b)]">npm name</span> in any JS or TS
                node - no URL or install step needed:
              </p>
              <div className="space-y-1">
                {USAGE_EXAMPLES.map(([code, note]) => (
                  <CopyLine key={code} text={code} note={note} />
                ))}
              </div>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  The first run downloads it from{" "}
                  <a className={linkClass} href="https://esm.sh" target="_blank" rel="noreferrer">
                    esm.sh
                  </a>{" "}
                  and keeps it on this device, so it works offline after that.
                </li>
                <li>Autocomplete and hover types appear once its types have downloaded.</li>
                <li>
                  Type a quote after <code>from</code> to get package names suggested.
                </li>
                <li>
                  Node's built-ins such as <code>fs</code> have no browser version.
                </li>
              </ul>
            </div>
          )}
        </div>
        )}

        {/* Download ahead of time */}
        <div>
          <h3 className={sectionLabel}>Download a package</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void download(query);
            }}
            className="flex gap-1.5"
          >
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--vsc-fg-muted,#616161)] pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => {
                  blurTimer.current = setTimeout(() => setSuggestOpen(false), 150);
                }}
                placeholder="e.g. lodash, zod, dayjs..."
                aria-label="npm package name"
                className="w-full text-xs pl-7 pr-2 py-1 rounded-[3px] border border-[var(--vsc-border-strong,#cecece)] bg-[var(--vsc-input,#ffffff)] text-[var(--vsc-fg,#3b3b3b)] placeholder-[var(--vsc-fg-muted,#616161)] focus:outline-none focus:ring-1 focus:ring-[var(--vsc-accent,#005fb8)] transition select-text"
              />
              {suggestOpen && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-56 overflow-y-auto custom-scrollbar rounded-[4px] border border-[var(--vsc-border-strong,#cecece)] bg-[var(--vsc-input,#ffffff)] shadow-lg">
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQuery(s.name);
                        void download(s.name);
                      }}
                      className="w-full text-left px-2 py-1.5 hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] cursor-pointer"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate">{s.name}</span>
                        <span className="text-[10px] text-[var(--vsc-fg-muted,#616161)] shrink-0">v{s.version}</span>
                      </div>
                      {s.description && (
                        <div className="text-[10px] text-[var(--vsc-fg-muted,#616161)] truncate">{s.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!cleanPackageName(query) || !!downloading}
              className="px-3 py-1 text-xs font-medium rounded-[3px] bg-[var(--vsc-accent,#005fb8)] text-[var(--vsc-accent-fg,#ffffff)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 cursor-pointer inline-flex items-center gap-1"
            >
              {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Download
            </button>
          </form>
          {downloading && (
            <p className="mt-1.5 text-[11px] text-[var(--vsc-fg-muted,#616161)]">Downloading "{downloading}" and its types...</p>
          )}
          {message && (
            <p
              className={`mt-1.5 text-[11px] leading-snug flex items-start gap-1 ${message.type === "error" ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              {message.type === "error" ? (
                <AlertCircle className="w-3 h-3 mt-px shrink-0" />
              ) : (
                <Check className="w-3 h-3 mt-px shrink-0" />
              )}
              <span className="select-text">{message.text}</span>
            </p>
          )}
        </div>

        {/* On this device */}
        <div>
          <h3 className={sectionLabel}>On this device ({packages?.length ?? 0})</h3>
          {packages === null ? (
            <p className="flex items-center gap-1.5 px-1 py-2 text-[11px] text-[var(--vsc-fg-muted,#616161)]">
              <Loader2 className="w-3 h-3 animate-spin" /> Reading this device...
            </p>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center border border-dashed rounded-[4px] border-[var(--vsc-border,#e5e5e5)]">
              <Package className="w-5 h-5 text-[var(--vsc-fg-muted,#616161)] opacity-50 mb-2" />
              <p className="text-xs">No npm packages yet</p>
              <p className="text-[11px] text-[var(--vsc-fg-muted,#616161)] mt-1 max-w-[210px] leading-snug">
                Import one in a JS or TS node and run it, or download one above.
              </p>
            </div>
          ) : (
            <div className={listBox}>
              {packages.map((pkg) => {
                const snippets = importSnippets(pkg);
                const open = expanded === pkg.name;
                const info = infos[pkg.name];
                return (
                  <div key={pkg.name} className="text-xs">
                    <div className="group flex items-center justify-between gap-1 px-2 py-1.5 hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition-colors">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : pkg.name)}
                        className="flex items-center gap-1 min-w-0 flex-1 text-left cursor-pointer"
                        aria-expanded={open}
                      >
                        {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{pkg.name}</span>
                        {pkg.version && (
                          <span className="text-[10px] text-[var(--vsc-fg-muted,#616161)] shrink-0">v{pkg.version}</span>
                        )}
                        <span className="text-[10px] text-[var(--vsc-fg-muted,#616161)] shrink-0 ml-auto pl-2">
                          {formatBytes(pkg.bytes)}
                        </span>
                      </button>

                      {confirmRemove === pkg.name ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => remove(pkg.name)}
                            disabled={removing === pkg.name}
                            className="px-1.5 py-0.5 text-[10px] font-medium bg-red-600 hover:bg-red-700 text-white rounded-[3px] transition cursor-pointer inline-flex items-center gap-1"
                          >
                            {removing === pkg.name && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                            Remove
                          </button>
                          <button
                            onClick={() => setConfirmRemove(null)}
                            className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] text-[var(--vsc-fg,#3b3b3b)] rounded-[3px] transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <CopyIconButton text={snippets.esm} />
                          <a href={npmUrl(pkg.name)} target="_blank" rel="noreferrer" className={iconBtn} title="Open on npm">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => setConfirmRemove(pkg.name)}
                            className="p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                            title="Remove from this device"
                            aria-label={`Remove ${pkg.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {open && (
                      <div className="px-2 pb-2.5 pt-1 space-y-2 bg-[var(--vsc-sidebar,#f8f8f8)]">
                        {info === "loading" ? (
                          <p className="text-[11px] text-[var(--vsc-fg-muted,#616161)] flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Asking npm...
                          </p>
                        ) : info?.description ? (
                          <p className="text-[11px] leading-snug select-text">{info.description}</p>
                        ) : null}

                        <div className="space-y-1">
                          <CopyLine text={snippets.esm} />
                          <CopyLine text={snippets.require} />
                        </div>

                        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                          <dt className="text-[var(--vsc-fg-muted,#616161)]">Version</dt>
                          <dd className="select-text">
                            {pkg.version ? `v${pkg.version}` : "unknown"}
                            {info && info !== "loading" && info.latest && pkg.version && info.latest !== pkg.version && (
                              <span className="text-[var(--vsc-fg-muted,#616161)]"> (latest v{info.latest})</span>
                            )}
                          </dd>
                          {info && info !== "loading" && info.license && (
                            <>
                              <dt className="text-[var(--vsc-fg-muted,#616161)]">License</dt>
                              <dd className="select-text">{info.license}</dd>
                            </>
                          )}
                          <dt className="text-[var(--vsc-fg-muted,#616161)]">Served by</dt>
                          <dd className="truncate">
                            <a className={linkClass} href={pkg.esmUrl} target="_blank" rel="noreferrer" title={pkg.esmUrl}>
                              esm.sh <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </dd>
                          <dt className="text-[var(--vsc-fg-muted,#616161)]">Links</dt>
                          <dd className="flex flex-wrap gap-x-2">
                            <a className={linkClass} href={npmUrl(pkg.name)} target="_blank" rel="noreferrer">
                              npm <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            {info && info !== "loading" && info.homepage && (
                              <a className={linkClass} href={info.homepage} target="_blank" rel="noreferrer">
                                Homepage <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                            {info && info !== "loading" && info.repository && /^https?:\/\//.test(info.repository) && (
                              <a className={linkClass} href={info.repository} target="_blank" rel="noreferrer">
                                Source <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </dd>
                          <dt className="text-[var(--vsc-fg-muted,#616161)]">Files</dt>
                          <dd>
                            {pkg.files.length} · {formatBytes(pkg.bytes)}
                          </dd>
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Storage */}
        {storage && (
          <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-[var(--vsc-fg-muted,#616161)]">
            <span className="flex items-center gap-1.5 min-w-0 truncate">
              <HardDrive className="w-3 h-3 shrink-0" />
              {formatBytes(storage.bytes)} on this device · {storage.backend === "opfs" ? "OPFS" : "IndexedDB"}
            </span>
            {storage.bytes > 0 &&
              (confirmClear ? (
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={async () => {
                      await clearNpmPackages();
                      setConfirmClear(false);
                      setExpanded(null);
                      void refresh();
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-medium bg-red-600 hover:bg-red-700 text-white rounded-[3px] transition cursor-pointer"
                  >
                    Clear all
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] text-[var(--vsc-fg,#3b3b3b)] rounded-[3px] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="shrink-0 hover:text-[var(--vsc-fg,#3b3b3b)] hover:underline underline-offset-2 cursor-pointer"
                  title="Delete every saved npm package and its types. Nodes that import them download them again."
                >
                  Clear all
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** The row's copy-import button. */
const CopyIconButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={iconBtn}
      title={`Copy: ${text}`}
      onClick={async () => {
        if (await copyToClipboard(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};
