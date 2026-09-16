import { formatFileSize } from "../lib/formatFileSize";
import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Database,
  ArrowRight,
  X,
  AlertCircle,
  FileJson,
  Table2,
  Layers,
  AlertTriangle,
  Key,
  Sparkles,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { parseCsv, parseCsvArray } from "../utils/dataFormats";

export function ImportModal() {
  const pendingImport = useStore((state) => state.pendingImport);
  const setPendingImport = useStore((state) => state.setPendingImport);
  const parsedData = useStore((state) => state.parsedData);

  const [importMode, setImportMode] = useState<
    "raw" | "array" | "object" | "replace" | "media_node"
  >("raw");
  const [keyStrategy, setKeyStrategy] = useState<
    "filename" | "intelligent" | "custom"
  >("filename");
  const [customKey, setCustomKey] = useState("");
  const [collisionAction, setCollisionAction] = useState<
    "rename" | "merge" | "replace_key"
  >("rename");

  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);

  const customKeyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingImport) return;

    // Auto-detect mode and gather metadata
    if (pendingImport.fileContext === "media") {
      setImportMode("media_node");
    } else if (pendingImport.filename.match(/\.(csv)$/i)) {
      try {
        const parsed = parseCsv(pendingImport.text || "");
        if (parsed && parsed.length > 0) {
          setRowCount(parsed.length);
          setDetectedHeaders(Object.keys(parsed[0] || {}));
          if (typeof parsed[0] === "object" && !Array.isArray(parsed[0])) {
            setImportMode("object");
          } else {
            setImportMode("array");
          }
        }
      } catch (e) {
        setImportMode("raw");
      }
    } else if (
      pendingImport.dataExcel ||
      pendingImport.filename.match(/\.(xlsx|xls|json|yaml|yml)$/i)
    ) {
      setImportMode("object");
    } else {
      setImportMode("raw");
    }
  }, [pendingImport]);

  useEffect(() => {
    if (keyStrategy === "custom" && customKeyInputRef.current) {
      customKeyInputRef.current.focus();
    }
  }, [keyStrategy]);

  useEffect(() => {
    if (!pendingImport) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingImport(null);
      if (e.key === "Enter" && e.ctrlKey) applyImport(); // Ctrl+Enter to apply
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingImport, importMode, keyStrategy, customKey, collisionAction]);

  if (!pendingImport) return null;

  const baseKeyName = pendingImport.filename
    .replace(/\.[^/.]+$/, "")
    .replace(/\W+/g, "_");
  const intelligentKeyName = baseKeyName + "_data";

  const targetKey =
    keyStrategy === "filename"
      ? baseKeyName
      : keyStrategy === "intelligent"
        ? intelligentKeyName
        : customKey || "imported_data";

  const formatBytes = (bytes: number) => formatFileSize(bytes, 'B', 1);

  const applyImport = () => {
    if (!pendingImport) return;

    // Register metadata for media items regardless of import mode
    if (pendingImport.fileContext === "media" && pendingImport.blobUrl) {
      useStore.getState().registerMediaMetadata(pendingImport.blobUrl, {
        filename: pendingImport.filename,
        mimeType: pendingImport.mimeType || "unknown",
        size: pendingImport.fileSize || 0,
      });
    }

    let resultData: any = pendingImport.text;
    if (importMode === "replace") {
      if (pendingImport.filename.match(/\.(csv)$/i)) {
        resultData = parseCsv(pendingImport.text);
      } else if (pendingImport.dataExcel) {
        resultData = pendingImport.dataExcel;
      } else {
        try {
          resultData = JSON.parse(pendingImport.text);
        } catch (e) {
          resultData = pendingImport.text;
        }
      }

      const { codeFormat } = useStore.getState();
      if (typeof resultData === "object") {
        if (codeFormat === "yaml") {
          import("js-yaml")
            .then((yaml) => {
              useStore.getState().setCode(yaml.default.dump(resultData));
              setPendingImport(null);
            })
            .catch((e) => {
              useStore.getState().setCode(JSON.stringify(resultData, null, 2));
              useStore.getState().setCodeFormat("json");
              setPendingImport(null);
            });
          return;
        } else {
          useStore.getState().setCode(JSON.stringify(resultData, null, 2));
          useStore.getState().setCodeFormat("json");
        }
      } else {
        useStore.getState().setCode(resultData);
      }
      setPendingImport(null);
      return;
    }

    // Process content for other modes
    if (importMode === "raw") {
      if (pendingImport.dataExcel) {
        const sheets = Object.keys(pendingImport.dataExcel);
        if (sheets.length === 1) {
          const rows = (pendingImport.dataExcel as any)[sheets[0]];
          if (Array.isArray(rows) && rows.length > 0) {
            const headerSet = new Set<string>();
            rows.forEach((r) =>
              Object.keys(r).forEach((k) => headerSet.add(k)),
            );
            const headers = Array.from(headerSet);
            const csvRows = [headers.join(",")];
            rows.forEach((r: any) => {
              csvRows.push(
                headers
                  .map((h) => {
                    let val = r[h];
                    if (val === null || val === undefined) return "";
                    val = String(val);
                    if (
                      val.includes(",") ||
                      val.includes('"') ||
                      val.includes("\n")
                    ) {
                      return `"${val.replace(/"/g, '""')}"`;
                    }
                    return val;
                  })
                  .join(","),
              );
            });
            resultData = csvRows.join("\n");
          } else {
            resultData = "";
          }
        } else {
          resultData = JSON.stringify(pendingImport.dataExcel, null, 2);
        }
      } else {
        resultData = pendingImport.blobUrl || pendingImport.text;
      }
    } else if (importMode === "media_node") {
      resultData = {
        _type: "media",
        filename: pendingImport.filename,
        mimeType: pendingImport.mimeType || "unknown",
        size: pendingImport.fileSize,
        assetId: pendingImport.assetId,
        thumbnailId: pendingImport.thumbnailId,
        url: pendingImport.assetId || pendingImport.blobUrl || "",
      };
    } else if (importMode === "array") {
      if (pendingImport.filename.match(/\.(csv)$/i)) {
        resultData = parseCsvArray(pendingImport.text);
      } else if (pendingImport.dataExcel) {
        const resultObj: Record<string, any[][]> = {};
        for (const sheet of Object.keys(pendingImport.dataExcel)) {
          const rows = (pendingImport.dataExcel as any)[sheet];
          if (Array.isArray(rows) && rows.length > 0) {
            // Collect all possible headers across all rows to be safe, but usually first row is enough if uniform
            const headerSet = new Set<string>();
            rows.forEach((r) =>
              Object.keys(r).forEach((k) => headerSet.add(k)),
            );
            const headers = Array.from(headerSet);
            resultObj[sheet] = [
              headers,
              ...rows.map((row: any) => headers.map((h) => row[h])),
            ];
          } else {
            resultObj[sheet] = [];
          }
        }
        const sheets = Object.keys(resultObj);
        if (sheets.length === 1) {
          resultData = resultObj[sheets[0]];
        } else {
          resultData = resultObj;
        }
      } else {
        resultData = pendingImport.text;
      }
    }

    const processImportResult = (finalResultData: any) => {
      const { parsedData, codeFormat } = useStore.getState();
      const currentData = parsedData || {};
      let actualKey = targetKey;
      let finalData = currentData;
      let targetPath = `root.${actualKey}`;

      if (
        typeof currentData === "object" &&
        !Array.isArray(currentData) &&
        currentData !== null
      ) {
        if (actualKey in currentData) {
          if (collisionAction === "rename") {
            let counter = 2;
            while (`${targetKey}_${counter}` in currentData) {
              counter++;
            }
            actualKey = `${targetKey}_${counter}`;
            targetPath = `root.${actualKey}`;
            finalData = { ...currentData, [actualKey]: finalResultData };
          } else if (collisionAction === "replace_key") {
            targetPath = `root.${actualKey}`;
            finalData = { ...currentData, [actualKey]: finalResultData };
          } else if (collisionAction === "merge") {
            targetPath = `root.${actualKey}`;
            const existingVal = currentData[actualKey];
            if (Array.isArray(existingVal) && Array.isArray(finalResultData)) {
              finalData = {
                ...currentData,
                [actualKey]: [...existingVal, ...finalResultData],
              };
            } else if (
              typeof existingVal === "object" &&
              existingVal !== null &&
              typeof finalResultData === "object" &&
              !Array.isArray(finalResultData)
            ) {
              finalData = {
                ...currentData,
                [actualKey]: { ...existingVal, ...finalResultData },
              };
            } else {
              finalData = { ...currentData, [actualKey]: finalResultData };
            }
          }
        } else {
          targetPath = `root.${actualKey}`;
          finalData = { ...currentData, [actualKey]: finalResultData };
        }
      } else if (Array.isArray(currentData)) {
        targetPath = `root[${currentData.length}]`;
        // if they append to an array, and resultData is an array, concat
        if (Array.isArray(finalResultData)) {
          finalData = [...currentData, ...finalResultData];
        } else {
          finalData = [...currentData, finalResultData];
        }
      } else {
        targetPath = `root.${actualKey}`;
        finalData = { [actualKey]: finalResultData };
      }

      if (codeFormat === "yaml") {
        import("js-yaml")
          .then((yaml) => {
            useStore.getState().setCode(yaml.default.dump(finalData));
            useStore.getState().setSelectedNodeId(targetPath);
            setPendingImport(null);
          })
          .catch((e) => {
            useStore.getState().setCode(JSON.stringify(finalData, null, 2));
            useStore.getState().setCodeFormat("json");
            useStore.getState().setSelectedNodeId(targetPath);
            setPendingImport(null);
          });
        return;
      }

      useStore.getState().setCode(JSON.stringify(finalData, null, 2));
      useStore.getState().setCodeFormat("json");
      useStore.getState().setSelectedNodeId(targetPath);
      setPendingImport(null);
    };

    if (importMode === "object") {
      if (pendingImport.filename.match(/\.(csv)$/i)) {
        resultData = parseCsv(pendingImport.text);
      } else if (pendingImport.dataExcel) {
        resultData = pendingImport.dataExcel;
      } else {
        try {
          resultData = JSON.parse(pendingImport.text);
        } catch (e) {
          if (pendingImport.filename.match(/\.(yaml|yml)$/i)) {
            import("js-yaml")
              .then((yaml) => {
                const parsed = yaml.default.load(pendingImport.text);
                processImportResult(parsed);
              })
              .catch(() => {
                processImportResult(pendingImport.text);
              });
            return; // wait for async
          } else {
            resultData = pendingImport.text;
          }
        }
      }
    }

    processImportResult(resultData);
  };

  const currentDataCheck = parsedData || {};
  const isCollision =
    importMode !== "replace" &&
    typeof currentDataCheck === "object" &&
    !Array.isArray(currentDataCheck) &&
    currentDataCheck !== null &&
    targetKey in currentDataCheck;

  const fileSize = formatBytes(
    pendingImport.fileSize || pendingImport.text?.length || 0,
  );

  const isMediaCtx = pendingImport.fileContext === "media";

  // Which interpretations this file supports (extension check, no regex needed here)
  const lowerName = pendingImport.filename.toLowerCase();
  const ext = lowerName.includes(".") ? lowerName.slice(lowerName.lastIndexOf(".") + 1) : "";
  const isSheet = ["csv", "xlsx", "xls"].includes(ext);
  const isStructured = isSheet || ["json", "yaml", "yml"].includes(ext) || !!pendingImport.dataExcel;

  const metaChips = [
    fileSize,
    pendingImport.mimeType,
    rowCount > 0 ? rowCount + (rowCount === 1 ? " row" : " rows") : "",
    detectedHeaders.length > 0 ? detectedHeaders.length + " columns" : "",
  ].filter(Boolean) as string[];

  const isArrayRoot = Array.isArray(parsedData);
  const isReplacing = importMode === "replace";

  const destinations = [
    { value: "filename" as const, label: "File name", icon: FileText, preview: baseKeyName },
    { value: "intelligent" as const, label: "Smart name", icon: Sparkles, preview: intelligentKeyName },
    { value: "custom" as const, label: "Custom key", icon: Key, preview: customKey || "imported_data" },
  ];

  return (
    <div
      className="fixed inset-0 z-[500] flex items-stretch justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => setPendingImport(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isMediaCtx ? "Import media" : "Import data"}
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden border-slate-200 bg-white text-slate-900 shadow-2xl animate-in fade-in duration-150 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl sm:border sm:zoom-in-95 dark:border-slate-800 dark:bg-[#0f172a] dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isMediaCtx ? "bg-pink-500/10 text-pink-500" : "bg-indigo-500/10 text-indigo-500"}`}
            >
              {isMediaCtx ? <Sparkles size={20} /> : <Database size={20} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight">
                {isMediaCtx ? "Import media" : "Import data"}
              </h2>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="max-w-[220px] truncate font-medium text-slate-600 dark:text-slate-300" title={pendingImport.filename}>
                  {pendingImport.filename}
                </span>
                {metaChips.map((chip) => (
                  <span key={chip} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => setPendingImport(null)}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto bg-slate-50/60 px-5 py-5 dark:bg-slate-950/30">
          {/* Step 1 - how to read the file */}
          <section className="space-y-3">
            <StepHeading
              step={1}
              title={isMediaCtx ? "How should we add this media?" : "How should we read this file?"}
            />

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {isMediaCtx ? (
                <>
                  <ModeCard
                    selected={importMode === "media_node"}
                    onSelect={() => setImportMode("media_node")}
                    icon={Layers}
                    tone="pink"
                    title="Media with details"
                    description="Adds the file with its name, type and size"
                  />
                  <ModeCard
                    selected={importMode === "raw"}
                    onSelect={() => setImportMode("raw")}
                    icon={Sparkles}
                    tone="indigo"
                    title="Just the link"
                    description="Adds only the file link, shown as a preview"
                  />
                </>
              ) : (
                <ModeCard
                  selected={importMode === "raw"}
                  onSelect={() => setImportMode("raw")}
                  icon={FileJson}
                  tone="indigo"
                  title="Plain text"
                  description="Keeps the file contents exactly as they are"
                />
              )}

              {!isMediaCtx && isSheet && (
                <ModeCard
                  selected={importMode === "array"}
                  onSelect={() => setImportMode("array")}
                  icon={Table2}
                  tone="blue"
                  title="Rows and columns"
                  description="Keeps the sheet as a table of cell values"
                />
              )}

              {!isMediaCtx && isStructured && (
                <ModeCard
                  selected={importMode === "object"}
                  onSelect={() => setImportMode("object")}
                  icon={Layers}
                  tone="emerald"
                  title="Named fields"
                  description="Uses the column titles as field names"
                  badge={detectedHeaders.length > 0 ? "Recommended" : undefined}
                />
              )}

              <ModeCard
                selected={isReplacing}
                onSelect={() => setImportMode("replace")}
                icon={AlertTriangle}
                tone="amber"
                title="Replace everything"
                description="Deletes what you have and uses this file instead"
              />
            </div>
          </section>

          {/* Step 2 - where it goes */}
          {!isReplacing && (
            <section className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <StepHeading step={2} title="Where should it go?" />

              {isArrayRoot ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  Your data is a list, so this file is added to the end of it.
                </div>
              ) : (
                <>
                  <div role="radiogroup" aria-label="Where should it go" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {destinations.map((option) => {
                      const selected = keyStrategy === option.value;
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setKeyStrategy(option.value)}
                          className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${selected
                            ? "border-blue-500/60 bg-blue-500/5 dark:bg-blue-500/10"
                            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                            }`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                            <Icon size={15} className={selected ? "text-blue-500" : "text-slate-400"} />
                            {option.label}
                          </span>
                          {option.value === "custom" && selected ? (
                            <input
                              ref={customKeyInputRef}
                              type="text"
                              value={customKey}
                              onChange={(e) => setCustomKey(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Type a name..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-800 outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                            />
                          ) : (
                            <span className="truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {option.preview}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
                    Added to your data as{" "}
                    <span className="font-mono text-slate-700 dark:text-slate-200">{targetKey}</span>
                  </p>
                </>
              )}

              {/* Same name already used */}
              {isCollision && (
                <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 animate-in fade-in slide-in-from-top-1 duration-200 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        <span className="font-mono">{targetKey}</span> is already used
                      </h4>
                      <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/70">
                        Choose what to do with the existing data.
                      </p>
                      <div
                        role="radiogroup"
                        aria-label="If the name is already used"
                        className="mt-2.5 flex flex-wrap gap-1.5"
                      >
                        {[
                          { value: "rename" as const, label: "Keep both" },
                          { value: "merge" as const, label: "Merge together" },
                          { value: "replace_key" as const, label: "Overwrite it" },
                        ].map((option) => {
                          const selected = collisionAction === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setCollisionAction(option.value)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${selected
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-amber-300/70 bg-white/70 text-amber-800 hover:bg-white dark:border-amber-500/30 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-500/10"
                                }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-[#0f172a]">
          <span className="hidden text-[11px] text-slate-400 sm:inline dark:text-slate-500">
            <kbd className="font-sans font-medium text-slate-500 dark:text-slate-400">Ctrl</kbd>
            {" + "}
            <kbd className="font-sans font-medium text-slate-500 dark:text-slate-400">Enter</kbd>
            {" to import, "}
            <kbd className="font-sans font-medium text-slate-500 dark:text-slate-400">Esc</kbd>
            {" to cancel"}
          </span>
          <div className="ml-auto flex flex-1 items-center gap-2 sm:flex-none">
            <button
              onClick={() => setPendingImport(null)}
              className="flex-1 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:flex-none sm:py-2 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={applyImport}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors active:scale-[0.98] sm:flex-none sm:py-2 ${isReplacing
                ? "bg-amber-600 hover:bg-amber-500"
                : "bg-indigo-600 hover:bg-indigo-500"
                }`}
            >
              {isReplacing ? "Replace everything" : isMediaCtx ? "Add media" : "Import"}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MODE_TONES = {
  indigo: { icon: "bg-indigo-500/10 text-indigo-500", ring: "border-indigo-500/60 bg-indigo-500/5 dark:bg-indigo-500/10", dot: "border-indigo-500 bg-indigo-500" },
  blue: { icon: "bg-blue-500/10 text-blue-500", ring: "border-blue-500/60 bg-blue-500/5 dark:bg-blue-500/10", dot: "border-blue-500 bg-blue-500" },
  emerald: { icon: "bg-emerald-500/10 text-emerald-500", ring: "border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-500/10", dot: "border-emerald-500 bg-emerald-500" },
  amber: { icon: "bg-amber-500/10 text-amber-500", ring: "border-amber-500/60 bg-amber-500/5 dark:bg-amber-500/10", dot: "border-amber-500 bg-amber-500" },
  pink: { icon: "bg-pink-500/10 text-pink-500", ring: "border-pink-500/60 bg-pink-500/5 dark:bg-pink-500/10", dot: "border-pink-500 bg-pink-500" },
} as const;

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {step}
      </span>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
    </div>
  );
}

/** One choice in the "how should we read this file" list */
function ModeCard({
  selected,
  onSelect,
  icon: Icon,
  tone,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: keyof typeof MODE_TONES;
  title: string;
  description: string;
  badge?: string;
}) {
  const colors = MODE_TONES[tone];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 ${selected
        ? colors.ring
        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
        }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors.icon}`}>
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</span>
          {badge && (
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${selected ? colors.dot : "border-slate-300 dark:border-slate-600"
          }`}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
    </button>
  );
}
