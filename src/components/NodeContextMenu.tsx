import React, { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import { Copy, Edit2, Trash2, Eye, Network, TableProperties, Database, FileText, Info, Type } from "lucide-react";
import { getDynamicActions } from "../utils/contextActions";
import { isProbableCsv, parseCsv, generateSchemaFromData } from "../utils/dataFormats";
import { safeStringify } from "../utils/safeStringify";
import { mediaCache } from "./SmartMediaRenderer";
import { getMediaType } from "./NodeRenderer";

export interface NodeContextMenuProps {
  contextMenu: { x: number; y: number; node: any };
  setContextMenu: (menu: null) => void;
  setTableViewData: (data: { data: any; title: string } | null) => void;
  setEditingNode: (nodeInfo: any) => void;
  applyJsonChange: (path: string, action: string, value: string, newKey?: string, typeOverride?: string) => void;
  setMediaInfoModal: (info: any) => void;
}

export function NodeContextMenu({
  contextMenu,
  setContextMenu,
  setTableViewData,
  setEditingNode,
  applyJsonChange,
  setMediaInfoModal,
}: NodeContextMenuProps) {
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const appTheme = useStore((s) => s.appTheme);
  const setActivePreviewText = useStore((s) => s.setActivePreviewText);
  const setActivePreviewMedia = useStore((s) => s.setActivePreviewMedia);
  const toggleManualMediaRender = useStore((s) => s.toggleManualMediaRender);
  const manuallyRenderedNodes = useStore((s) => s.manuallyRenderedNodes);
  const showMediaPreview = useStore((s) => s.showMediaPreview);
  const knownDataUrls = useStore((s) => s.knownDataUrls);

  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const rect = contextMenuRef.current.getBoundingClientRect();
      const x = contextMenu.x;
      const y = contextMenu.y;

      let newX = x;
      let newY = y;

      if (x + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 10;
      }
      if (y + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 10;
      }

      newX = Math.max(10, newX);
      newY = Math.max(10, newY);

      if (newX !== x || newY !== y) {
        contextMenuRef.current.style.left = `${newX}px`;
        contextMenuRef.current.style.top = `${newY}px`;
      }
    }
  }, [contextMenu]);

  if (!contextMenu) return null;

  return createPortal(
          <div className={appTheme}>
            <div
              ref={contextMenuRef}
              className="fixed z-50 bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700/50 shadow-2xl rounded-md py-1 overflow-hidden min-w-[220px] no-export"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="px-3 py-2.5 border-b border-slate-300 dark:border-slate-700/50 bg-slate-50 dark:bg-[#0f172a]/50">
                <span
                  className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate block max-w-[200px]"
                  title={contextMenu.node.path}
                >
                  {contextMenu.node.path}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mt-1 block">
                  {contextMenu.node.type}
                </span>
              </div>
              <button
                className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors"
                onClick={() => {
                  let valToCopy = "";
                  const { code, parsedData, codeFormat } = useStore.getState();
                  // Try to extract original JSON value to copy
                  try {
                    const nodePath = contextMenu.node.path;
                    if (nodePath === "root") {
                      valToCopy =
                        codeFormat === "yaml"
                          ? JSON.stringify(parsedData, null, 2)
                          : code;
                    } else {
                      const parts = nodePath
                        .replace(/^root/, "")
                        .split(/(?=\[)|(?=\.)/)
                        .filter(Boolean)
                        .map((p) =>
                          p.startsWith(".")
                            ? p.substring(1)
                            : p.replace(/[\[\]]/g, ""),
                        );
                      let current = parsedData;
                      for (let i = 0; i < parts.length; i++) {
                        current = current[parts[i]];
                      }
                      if (current === undefined) {
                        throw new Error("Path not in original editor code");
                      }
                      valToCopy =
                        typeof current === "object" && current !== null
                          ? JSON.stringify(current, null, 2)
                          : String(current);
                    }
                  } catch (e) {
                    if (contextMenu.node.rawValue !== undefined) {
                      const raw = contextMenu.node.rawValue;
                      valToCopy =
                        typeof raw === "object" && raw !== null
                          ? safeStringify(raw, 2)
                          : String(raw);
                    } else {
                      valToCopy =
                        contextMenu.node.value !== undefined
                          ? String(contextMenu.node.value)
                          : "Could not copy";
                    }
                  }
                  navigator.clipboard.writeText(valToCopy);
                  setContextMenu(null);
                }}
              >
                <Copy size={16} className="text-slate-400" />
                Copy Value
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.node.path);
                  setContextMenu(null);
                }}
              >
                <Copy size={16} className="text-slate-400" />
                Copy JSON Path
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.node.name);
                  setContextMenu(null);
                }}
              >
                <Copy size={16} className="text-slate-400" />
                Copy Key
              </button>

              {/* CSV/Table Actions */}
              {contextMenu.node.type === "string" &&
                typeof contextMenu.node.name === "string" &&
                !contextMenu.node.name.endsWith("_api_node") &&
                !contextMenu.node.name.endsWith("_py_node") &&
                !contextMenu.node.name.endsWith("_js_node") &&
                !contextMenu.node.name.endsWith("_ts_node") &&
                isProbableCsv(contextMenu.node.value) && (
                  <>
                    <button
                      className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-cyan-600 dark:text-cyan-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all flex items-center gap-3 transition-colors"
                      onClick={() => {
                        try {
                          const data = parseCsv(contextMenu.node.value);
                          setTableViewData({
                            data,
                            title: String(contextMenu.node.name),
                          });
                          setContextMenu(null);
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      <TableProperties size={16} />
                      Open as Table (CSV)
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-purple-600 dark:text-purple-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all flex items-center gap-3 transition-colors"
                      onClick={() => {
                        try {
                          const data = parseCsv(contextMenu.node.value);
                          applyJsonChange(
                            contextMenu.node.path,
                            "edit",
                            JSON.stringify(data),
                            undefined,
                            "array", // Overriding to array so backend recognizes it
                          );
                          setContextMenu(null);
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      <Database size={16} />
                      Convert to JSON List
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all flex items-center gap-3 transition-colors"
                      onClick={() => {
                        try {
                          const data = parseCsv(contextMenu.node.value);
                          const schema = generateSchemaFromData(data);
                          applyJsonChange(
                            contextMenu.node.path + "_schema",
                            "add",
                            JSON.stringify(schema),
                          );
                          setContextMenu(null);
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      <FileText size={16} />
                      Generate Schema
                    </button>
                  </>
                )}
              {/* General Array -> Table Action */}
              {contextMenu.node.type === "array" && (
                <button
                  className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-cyan-600 dark:text-cyan-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all flex items-center gap-3 transition-colors"
                  onClick={() => {
                    try {
                      setTableViewData({
                        data: contextMenu.node.rawValue,
                        title: String(contextMenu.node.name),
                      });
                      setContextMenu(null);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  <TableProperties size={16} />
                  Open as Table View
                </button>
              )}
              {/* General Array -> Generate Schema */}
              {contextMenu.node.type === "array" && (
                <button
                  className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all flex items-center gap-3 transition-colors"
                  onClick={() => {
                    try {
                      const schema = generateSchemaFromData(
                        contextMenu.node.rawValue as any[],
                      );
                      applyJsonChange(
                        contextMenu.node.path + "_schema",
                        "add",
                        schema,
                      );
                      setContextMenu(null);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  <FileText size={16} />
                  Extract Schema
                </button>
              )}
              {getDynamicActions(contextMenu.node.value).map((action) => (
                <button
                  key={action.id}
                  className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700/50 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-3 transition-colors"
                  onClick={() => {
                    action.action(contextMenu.node.value);
                    setContextMenu(null);
                  }}
                >
                  <action.icon size={16} />
                  {action.label}
                </button>
              ))}

              {typeof contextMenu.node.name === "string" &&
                (contextMenu.node.name.endsWith("_api_node") ||
                  contextMenu.node.name.endsWith("_py_node") ||
                  contextMenu.node.name.endsWith("_js_node") ||
                  contextMenu.node.name.endsWith("_ts_node")) && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-3 transition-colors"
                    onClick={() => {
                      let newName = contextMenu.node.name;
                      newName = newName
                        .replace("_api_node", "")
                        .replace("_py_node", "")
                        .replace("_js_node", "")
                        .replace("_ts_node", "");

                      let valStr = "";
                      if (contextMenu.node.rawValue !== undefined) {
                        if (typeof contextMenu.node.rawValue === "object" && contextMenu.node.rawValue !== null) {
                          valStr = safeStringify(contextMenu.node.rawValue);
                        } else {
                          valStr = String(contextMenu.node.rawValue);
                        }
                      } else {
                        valStr = String(contextMenu.node.value);
                      }

                      applyJsonChange(
                        contextMenu.node.path,
                        "edit",
                        valStr,
                        newName,
                        contextMenu.node.type,
                      );
                      setContextMenu(null);
                    }}
                  >
                    <Type size={16} />
                    Convert to Normal
                  </button>
                )}

              {contextMenu.node.type === "string" &&
                String(contextMenu.node.name).endsWith("_api_node") === false &&
                getMediaType(String(contextMenu.node.value)) !== null &&
                !knownDataUrls[String(contextMenu.node.value)] && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-emerald-600 dark:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-3 transition-colors"
                    onClick={() => {
                      toggleManualMediaRender(contextMenu.node.id);
                      setContextMenu(null);
                    }}
                  >
                    <Eye
                      size={16}
                      className="text-emerald-400 dark:text-emerald-500"
                    />
                    {manuallyRenderedNodes &&
                      (manuallyRenderedNodes[contextMenu.node.id] !== undefined
                        ? manuallyRenderedNodes[contextMenu.node.id]
                        : showMediaPreview)
                      ? "Hide Media Preview"
                      : "Render Media Preview"}
                  </button>
                )}

              {contextMenu.node.type === "string" &&
                String(contextMenu.node.name).endsWith("_api_node") === false &&
                typeof contextMenu.node.name === "string" &&
                String(contextMenu.node.value).match(/^https?:\/\//) && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-amber-600 dark:text-amber-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-3 transition-colors"
                    onClick={() => {
                      applyJsonChange(
                        contextMenu.node.path,
                        "edit",
                        contextMenu.node.rawValue !== undefined
                          ? String(contextMenu.node.rawValue)
                          : String(contextMenu.node.value),
                        String(contextMenu.node.name) +
                        "_api_node_tmp".replace("_tmp", ""),
                        "string",
                      );
                      setContextMenu(null);
                    }}
                  >
                    <Network
                      size={16}
                      className="text-amber-400 dark:text-amber-500"
                    />
                    Convert to API Node
                  </button>
                )}

              {contextMenu.node.type === "string" &&
                useStore.getState().uploadedMediaMetadata[
                String(contextMenu.node.value)
                ] && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-pink-600 dark:text-pink-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-3 transition-colors"
                    onClick={() => {
                      setMediaInfoModal(
                        useStore.getState().uploadedMediaMetadata[
                        String(contextMenu.node.value)
                        ],
                      );
                      setContextMenu(null);
                    }}
                  >
                    <Info size={16} />
                    Media Info
                  </button>
                )}

              {(() => {
                const nodeVal = String(contextMenu.node.value || "");
                const nodePath = String(contextMenu.node.path);
                const rawObj = typeof contextMenu.node.rawValue === 'object' ? contextMenu.node.rawValue : null;
                const assetIdToCheck = rawObj?.url || rawObj?.filename || nodeVal;

                const state = useStore.getState();
                let assetMimeType = '';
                if (assetIdToCheck) {
                  const assetMeta = state.uploadedMediaMetadata[assetIdToCheck];
                  if (assetMeta && assetMeta.mimeType) {
                    assetMimeType = assetMeta.mimeType.toLowerCase();
                  }
                }

                const isImageNode =
                  getMediaType(nodeVal) === 'image' ||
                  nodePath.match(/\.(png|jpe?g|gif|webp|image)$/i) ||
                  nodePath.endsWith('_image_node') ||
                  assetMimeType.startsWith('image/');

                if (isImageNode && contextMenu.node.path !== "root") {
                  return (
                    <button
                      className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-purple-600 dark:text-purple-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-3 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (state.openWorkspaceTab) {
                          state.openWorkspaceTab(contextMenu.node.path, false);
                        }
                        if (state.setExpandedJsNodeId) {
                          state.setExpandedJsNodeId(contextMenu.node.path);
                        }
                        setContextMenu(null);
                      }}
                    >
                      <Edit2 size={16} />
                      Edit Image
                    </button>
                  );
                }
                return null;
              })()}

              {String(contextMenu.node.name).endsWith("_api_node") === false &&
                (contextMenu.node.type === "string" ||
                  contextMenu.node.type === "number") && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-3 transition-colors"
                    onClick={() => {
                      const val =
                        contextMenu.node.value !== undefined
                          ? String(contextMenu.node.value)
                          : "";

                      if (contextMenu.node.type === "string") {
                        const isImage = val.match(
                          /\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i,
                        );
                        const isVideo = val.match(
                          /\.(mp4|webm|ogv|mov)(\?.*)?$/i,
                        );
                        const isAudio = val.match(
                          /\.(mp3|wav|flac|aac|ogg)(\?.*)?$/i,
                        );
                        const isPdf =
                          val.match(/\.pdf(\?.*)?$/i) ||
                          val.startsWith("data:application/pdf") ||
                          (val.startsWith("blob:http") && val.includes("pdf"));

                        const isMediaEnabled =
                          useStore.getState().showMediaPreview;
                        const isHttpUrl = val.match(/^https?:\/\//i);

                        let detectedType: string | null = null;
                        let detectedUrl = val;

                        if (isImage) detectedType = "image";
                        else if (isVideo) detectedType = "video";
                        else if (isAudio) detectedType = "audio";
                        else if (isPdf) detectedType = "pdf";
                        else if (isMediaEnabled && isHttpUrl) {
                          detectedType = "smart";
                          const cached = mediaCache.get(val);
                          if (cached && cached !== "failed") {
                            const htmlStr =
                              typeof cached === "string"
                                ? cached
                                : cached?.html || "";
                            const srcMatch = htmlStr.match(/src="([^"]+)"/);
                            if (srcMatch && srcMatch[1])
                              detectedUrl = srcMatch[1];

                            const strategy =
                              typeof cached === "object"
                                ? cached.strategy
                                : null;

                            if (
                              strategy === "img" ||
                              htmlStr.startsWith("<img") ||
                              htmlStr.includes("<img")
                            )
                              detectedType = "image";
                            else if (
                              strategy === "video" ||
                              htmlStr.startsWith("<video") ||
                              htmlStr.includes("<video")
                            )
                              detectedType = "video";
                            else if (
                              strategy === "audio" ||
                              htmlStr.startsWith("<audio") ||
                              htmlStr.includes("<audio")
                            )
                              detectedType = "audio";
                          }
                        }

                        if (detectedType) {
                          setActivePreviewMedia({
                            url: detectedUrl,
                            type: detectedType as any,
                          });
                          setContextMenu(null);
                          return;
                        }
                      }

                      setActivePreviewText(val, contextMenu.node.path);
                      setContextMenu(null);
                    }}
                  >
                    <Eye size={16} />
                    Preview
                  </button>
                )}

              <button
                className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors"
                onClick={() => {
                  let valToEdit = "";
                  let currentKey = "";
                  const { code, parsedData, codeFormat } = useStore.getState();
                  try {
                    const nodePath = contextMenu.node.path;
                    if (nodePath === "root") {
                      valToEdit =
                        codeFormat === "yaml"
                          ? JSON.stringify(parsedData, null, 2)
                          : code;
                    } else if (nodePath.includes(".__fetched")) {
                      const parts = nodePath
                        .split(/(?=\[)|(?=\.)/)
                        .filter(Boolean)
                        .map((p) =>
                          p.startsWith(".")
                            ? p.substring(1)
                            : p.replace(/[\[\]]/g, ""),
                        );
                      currentKey = parts[parts.length - 1];

                      const raw = contextMenu.node.rawValue;
                      if (raw !== undefined) {
                        valToEdit =
                          typeof raw === "object" && raw !== null
                            ? safeStringify(raw, 2)
                            : String(raw);
                      } else {
                        valToEdit =
                          contextMenu.node.value !== undefined
                            ? String(contextMenu.node.value)
                            : "";
                      }
                    } else {
                      const parts = nodePath
                        .replace(/^root/, "")
                        .split(/(?=\[)|(?=\.)/)
                        .filter(Boolean)
                        .map((p) =>
                          p.startsWith(".")
                            ? p.substring(1)
                            : p.replace(/[\[\]]/g, ""),
                        );
                      currentKey = parts[parts.length - 1];
                      let current = parsedData;
                      for (let i = 0; i < parts.length; i++) {
                        current = current[parts[i]];
                      }
                      if (current === undefined) {
                        throw new Error("Path not in original editor code");
                      }
                      valToEdit =
                        typeof current === "object" && current !== null
                          ? JSON.stringify(current, null, 2)
                          : String(current);
                    }
                  } catch (e) {
                    const raw = contextMenu.node.rawValue;
                    if (raw !== undefined) {
                      valToEdit =
                        typeof raw === "object" && raw !== null
                          ? safeStringify(raw, 2)
                          : String(raw);
                    } else {
                      valToEdit =
                        contextMenu.node.value !== undefined
                          ? String(contextMenu.node.value)
                          : "";
                    }
                  }

                  setEditingNode({
                    node: contextMenu.node,
                    value: valToEdit,
                    action: "edit",
                    typeOverride: "auto",
                    newKey: currentKey,
                  });
                  setContextMenu(null);
                }}
              >
                <Edit2 size={16} className="text-blue-400" />
                Edit Content
              </button>

              {(contextMenu.node.type === "object" ||
                contextMenu.node.type === "array") && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-slate-900 dark:hover:text-white flex items-center gap-3 transition-colors"
                    onClick={() => {
                      setEditingNode({
                        node: contextMenu.node,
                        value: "",
                        action: "add",
                        typeOverride: "auto",
                      });
                      setContextMenu(null);
                    }}
                  >
                    <Edit2 size={16} className="text-green-400" />
                    Add {contextMenu.node.type === "array" ? "Item" : "Property"}
                  </button>
                )}

              {contextMenu.node.path !== "root" && (
                <button
                  className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-red-500 dark:text-red-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all hover:text-red-600 dark:hover:text-red-300 flex items-center gap-3 transition-colors"
                  onClick={() => {
                    applyJsonChange(contextMenu.node.path, "delete", "");
                    setContextMenu(null);
                  }}
                >
                  <Trash2 size={16} />
                  Delete Node
                </button>
              )}
            </div>
          </div>, document.body);
}
