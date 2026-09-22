import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import {
  Copy, Edit2, Trash2, Eye, Network, TableProperties, Database, FileText, Info, Type,
  Plus, ChevronRight, Braces, Brackets, Hash, ToggleLeft, CircleSlash,
  Globe, FileCode, Code, Terminal, ListTodo, Sigma, Search, Share2, Image as ImageIcon,
  ArrowDown, ArrowRight, CircleDot, Waypoints, Shrink, Brain, LayoutGrid, Atom, Check, RotateCcw,
} from "lucide-react";
import { type LayoutMode } from "../constants/visualizer";
import { getDynamicActions } from "../utils/contextActions";
import { isProbableCsv, parseCsv, generateSchemaFromData } from "../utils/dataFormats";
import { safeStringify } from "../utils/safeStringify";
import { mediaCache } from "./SmartMediaRenderer";
import { getMediaType } from "./NodeRenderer";

/** Empty values a user can insert straight from the menu */
const NODE_LAYOUT_OPTIONS: { value: LayoutMode; label: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { value: "horizontal", label: "Horizontal", description: "Left-to-right tree", icon: ArrowRight },
  { value: "vertical", label: "Vertical", description: "Top-down tree", icon: ArrowDown },
  { value: "radial", label: "Radial", description: "Rings around node", icon: CircleDot },
  { value: "compact", label: "Compact", description: "Dense tree", icon: Shrink },
  { value: "grid", label: "Grid", description: "Rows and columns", icon: LayoutGrid },
  { value: "mindmap", label: "Mind map", description: "Bilateral branches", icon: Brain },
  { value: "molecule", label: "Molecule", description: "Atom clusters", icon: Atom },
  { value: "force", label: "Force", description: "Physics network", icon: Waypoints },
];

const EMPTY_CHILD_TYPES = [
  { type: "object", label: "Object", hint: "{}", icon: Braces },
  { type: "array", label: "Array", hint: "[]", icon: Brackets },
  { type: "string", label: "String", hint: '""', icon: Type },
  { type: "number", label: "Number", hint: "0", icon: Hash },
  { type: "boolean", label: "Boolean", hint: "false", icon: ToggleLeft },
  { type: "null", label: "Null", hint: "null", icon: CircleSlash },
] as const;

/** Special nodes are keys with a suffix plus a starter value (same defaults as the file explorer) */
const SPECIAL_NODE_TYPES = [
  { suffix: "api_node", label: "API", icon: Globe, iconClass: "text-amber-500", type: "string", value: "https://jsonplaceholder.typicode.com/todos/1" },
  { suffix: "js_node", label: "JS", icon: FileCode, iconClass: "text-yellow-500", type: "string", value: "// JS execution starts here!\n" },
  { suffix: "ts_node", label: "TS", icon: Code, iconClass: "text-blue-500", type: "string", value: "const msg: string = 'TS execution starts here!';\n" },
  { suffix: "py_node", label: "Python", icon: Terminal, iconClass: "text-emerald-500", type: "string", value: "print('Python execution starts here!')" },
  { suffix: "todo_node", label: "Todo", icon: ListTodo, iconClass: "text-purple-500", type: "string", value: JSON.stringify({ title: "Tasks", tasks: [] }) },
  { suffix: "math_node", label: "Math", icon: Sigma, iconClass: "text-rose-500", type: "string", value: "f(x) = sin(x)" },
  { suffix: "transfer_node", label: "Transfer", icon: Share2, iconClass: "text-indigo-500", type: "string", value: "" },
  { suffix: "image_node", label: "Image", icon: ImageIcon, iconClass: "text-cyan-500", type: "string", value: "" },
] as const;

const JSON_NODE_TYPES = new Set(["object", "array", "string", "number", "boolean", "null"]);

const splitNodePath = (path: string) =>
  path
    .split(/(?=\[)|(?=\.)/)
    .filter(Boolean)
    .map((part) => (part.startsWith(".") ? part.substring(1) : part.replace(/[\[\]"]/g, "")));

/** Reads the current value at a node path, including paths inside fetched API responses */
const getValueAtNodePath = (path: string) => {
  const { parsedData, apiNodeResponses } = useStore.getState();
  if (path === "root") return parsedData;

  const fetchedMarker = ".__fetched";
  const markerIndex = path.indexOf(fetchedMarker);
  let current: any = markerIndex >= 0 ? apiNodeResponses[path.substring(0, markerIndex)] : parsedData;
  const relativePath = markerIndex >= 0 ? path.substring(markerIndex + fetchedMarker.length) : path.replace(/^root/, "");

  for (const part of splitNodePath(relativePath)) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
};

/** "root.a.b" → "root.a", "root.list[2]" → "root.list" */
const getParentNodePath = (path: string) => {
  if (path === "root") return null;
  const match = path.match(/^(.+?)(\.[^.[\]]+|\[[^\]]*\])$/);
  return match ? match[1] : null;
};

const getUniqueKey = (target: Record<string, unknown>, type: string) => {
  const base = `new_${type}`;
  // Special node suffixes must stay at the end of the key: new_api_node, new_2_api_node
  const suffixMatch = type.match(/^(.*)_(\w+_node)$/) || (type.endsWith("_node") ? [type, "", type] : null);
  if (suffixMatch) {
    const suffix = suffixMatch[2];
    const special = `new_${suffix}`;
    if (!(special in target)) return special;
    let n = 2;
    while (`new_${n}_${suffix}` in target) n++;
    return `new_${n}_${suffix}`;
  }
  if (!(base in target)) return base;
  let counter = 2;
  while (`${base}_${counter}` in target) counter++;
  return `${base}_${counter}`;
};

export interface NodeContextMenuProps {
  contextMenu: { x: number; y: number; node: any };
  setContextMenu: (menu: null) => void;
  setTableViewData: (data: { data: any; title: string; path?: string } | null) => void;
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
  const expandNode = useStore((s) => s.expandNode);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const layoutMode = useStore((s) => s.layoutMode);
  const nodeLayoutOverrides = useStore((s) => s.nodeLayoutOverrides);
  const setNodeLayout = useStore((s) => s.setNodeLayout);
  const removeNodeLayout = useStore((s) => s.removeNodeLayout);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [addMode, setAddMode] = useState<"child" | "sibling">("child");

  // Two places a new node can go: inside this node (objects/arrays) or next to it (its parent)
  const menuNode = contextMenu?.node;
  const isJsonNode = !!menuNode && JSON_NODE_TYPES.has(menuNode.type) && !String(menuNode.path).includes(".__response");
  const isContainerNode = isJsonNode && (menuNode.type === "object" || menuNode.type === "array");

  const childTargetPath: string | null = isContainerNode ? menuNode.path : null;
  const childTargetValue = childTargetPath ? getValueAtNodePath(childTargetPath) : undefined;
  const canAddChild = !!childTargetPath && childTargetValue !== null && typeof childTargetValue === "object";

  const siblingTargetPath: string | null = isJsonNode ? getParentNodePath(menuNode.path) : null;
  const siblingTargetValue = siblingTargetPath ? getValueAtNodePath(siblingTargetPath) : undefined;
  const canAddSibling = !!siblingTargetPath && siblingTargetValue !== null && typeof siblingTargetValue === "object";

  const canAdd = canAddChild || canAddSibling;
  const effectiveMode: "child" | "sibling" =
    addMode === "child" ? (canAddChild ? "child" : "sibling") : (canAddSibling ? "sibling" : "child");
  const addTargetPath = effectiveMode === "child" ? childTargetPath : siblingTargetPath;
  const addTargetValue = effectiveMode === "child" ? childTargetValue : siblingTargetValue;
  const addTargetIsArray = Array.isArray(addTargetValue);
  const targetName = effectiveMode === "child"
    ? String(menuNode?.name ?? "")
    : String(siblingTargetPath === "root" ? "root" : (siblingTargetPath ?? "").split(/[.[\]"]/).filter(Boolean).pop() ?? "");

  // Start collapsed each time the menu opens, defaulting to "child" when the node can hold children
  useLayoutEffect(() => {
    setIsAddOpen(false);
    setIsLayoutOpen(false);
    setAddMode(isContainerNode ? "child" : "sibling");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu?.node?.path, contextMenu?.x, contextMenu?.y]);

  /** Inserts a value under the current target with a generated key (objects) or at the end (arrays) */
  const insertNode = (keyType: string, valueStr: string, typeOverride: string) => {
    if (!addTargetPath || addTargetValue === null || typeof addTargetValue !== "object") return;

    let newNodePath: string;
    if (Array.isArray(addTargetValue)) {
      newNodePath = `${addTargetPath}[${addTargetValue.length}]`;
      applyJsonChange(addTargetPath, "add", valueStr, undefined, typeOverride);
    } else {
      const key = getUniqueKey(addTargetValue, keyType);
      newNodePath = `${addTargetPath}.${key}`;
      applyJsonChange(addTargetPath, "add", valueStr, key, typeOverride);
    }

    // Make sure the new node is visible and highlighted
    expandNode(addTargetPath);
    setSelectedNodeId(newNodePath);
    setContextMenu(null);
  };

  useLayoutEffect(() => {
    const menu = contextMenuRef.current;
    if (!contextMenu || !menu) return;

    const margin = 10;

    /*
     * Capped before measuring, so the position below is worked out from the height the menu
     * will really have once the add-node section is open.
     *
     * The cap used to be a max-h-[calc(100vh-20px)] class while the clamp below measured
     * window.innerHeight. Those disagree wherever 100vh counts space the page cannot use, most
     * obviously on mobile where it includes the address bar: the menu was allowed to grow taller
     * than the room available, so its last items sat off the bottom of the screen. Both now come
     * from innerHeight.
     */
    menu.style.maxHeight = `${window.innerHeight - margin * 2}px`;

    const rect = menu.getBoundingClientRect();
    const left = Math.max(margin, Math.min(contextMenu.x, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(contextMenu.y, window.innerHeight - rect.height - margin));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    // Re-measured when the add section opens, or switches between child and sibling
  }, [contextMenu, isAddOpen, addMode, isLayoutOpen]);

  if (!contextMenu) return null;

  return createPortal(
          <div className={appTheme}>
            <div
              ref={contextMenuRef}
              className="fixed z-50 bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700/50 shadow-2xl rounded-md py-1 overflow-x-hidden overflow-y-auto custom-scrollbar min-w-[220px] max-w-[260px] no-export"
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
                isProbableCsv(contextMenu.node.rawValue ?? contextMenu.node.value) && (
                  <>
                    <button
                      className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-cyan-600 dark:text-cyan-400 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:scale-[1.01] transition-all flex items-center gap-3 transition-colors"
                      onClick={() => {
                        try {
                          const rawVal = contextMenu.node.rawValue ?? contextMenu.node.value;
                          const data = parseCsv(rawVal);
                          setTableViewData({
                            data,
                            title: String(contextMenu.node.name),
                            path: contextMenu.node.path,
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
                          const rawVal = contextMenu.node.rawValue ?? contextMenu.node.value;
                          const data = parseCsv(rawVal);
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
                          const rawVal = contextMenu.node.rawValue ?? contextMenu.node.value;
                          const data = parseCsv(rawVal);
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
                        path: contextMenu.node.path,
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

                        if (detectedType === "audio") {
                          const url = detectedUrl;
                          const cleanUrl = url.split("?")[0].split("#")[0];
                          const fileName = cleanUrl.split("/").pop() || "Audio Track";
                          import("../lib/db").then(({ db }) => {
                            db.audio_tracks.get(url).then((existingTrack) => {
                              const track: any = existingTrack || {
                                id: url,
                                title: fileName,
                                artist: "Workspace Audio",
                                source: url,
                                type: "audio/mpeg",
                                createdAt: Date.now(),
                              };
                              import("../audio/stores/audioStore").then((m) => {
                                m.useAudioStore.getState().playTrackNow(track);
                              });
                              import("../audio/services/audioEngine").then((m) => {
                                m.audioEngine.playTrack(track);
                              });
                            });
                          });
                          setContextMenu(null);
                          return;
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

              {/* Children Layout Section */}
              {(() => {
                const nodeId = menuNode?.id || menuNode?.path;
                const hasLayoutOverride = !!(nodeId && nodeLayoutOverrides?.[nodeId]);
                const currentNodeLayout = (nodeId && nodeLayoutOverrides?.[nodeId]) || layoutMode;

                return (
                  <div className="my-1 border-y border-slate-200 dark:border-slate-700/50">
                    <button
                      className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100/80 dark:hover:bg-white/10 transition-colors flex items-center gap-3"
                      aria-expanded={isLayoutOpen}
                      onClick={() => setIsLayoutOpen((open) => !open)}
                    >
                      <LayoutGrid size={16} />
                      <span>Layout</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-auto mr-1 truncate max-w-[70px]">
                        {hasLayoutOverride ? `${currentNodeLayout}*` : currentNodeLayout}
                      </span>
                      <ChevronRight
                        size={14}
                        className={`text-slate-400 transition-transform ${isLayoutOpen ? "rotate-90" : ""}`}
                      />
                    </button>

                    {isLayoutOpen && (
                      <div className="px-2 pb-2 pt-1">
                        <div className="mb-1.5 flex items-center justify-between px-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Children Layout
                          </span>
                          {hasLayoutOverride && (
                            <button
                              onClick={() => {
                                if (nodeId) removeNodeLayout(nodeId);
                                setContextMenu(null);
                              }}
                              className="text-[10px] text-amber-500 hover:text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline"
                              title={`Reset to global toolbar layout (${layoutMode})`}
                            >
                              <RotateCcw size={10} />
                              Reset
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {NODE_LAYOUT_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                            const isSelected = currentNodeLayout === value;
                            return (
                              <button
                                key={value}
                                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-all ${
                                  isSelected
                                    ? "border-indigo-500/60 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400/60 dark:bg-indigo-950/60 dark:text-indigo-300"
                                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/80 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                                }`}
                                title={description}
                                onClick={() => {
                                  if (nodeId) {
                                    setNodeLayout(nodeId, value);
                                  }
                                  setContextMenu(null);
                                }}
                              >
                                <Icon size={14} className={isSelected ? "text-indigo-600 dark:text-indigo-400 flex-shrink-0" : "text-slate-400 flex-shrink-0"} />
                                <span className="truncate flex-1">{label}</span>
                                {isSelected && <Check size={12} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {canAdd && (
                <div className="my-1 border-y border-slate-200 dark:border-slate-700/50">
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg my-0.5 text-emerald-600 dark:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-white/10 transition-colors flex items-center gap-3"
                    aria-expanded={isAddOpen}
                    onClick={() => setIsAddOpen((open) => !open)}
                  >
                    <Plus size={16} />
                    Add node
                    <ChevronRight
                      size={14}
                      className={`ml-auto text-slate-400 transition-transform ${isAddOpen ? "rotate-90" : ""}`}
                    />
                  </button>

                  {isAddOpen && (
                    <div className="px-2 pb-2">
                      {/* Where to insert */}
                      <div role="radiogroup" aria-label="Insert position" className="mb-1.5 flex rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700/60 dark:bg-slate-900/60">
                        {([
                          { mode: "child", label: "Child", enabled: canAddChild, disabledHint: "Only objects and arrays can hold children" },
                          { mode: "sibling", label: "Sibling", enabled: canAddSibling, disabledHint: "The root node has no siblings" },
                        ] as const).map((option) => {
                          const active = effectiveMode === option.mode;
                          return (
                            <button
                              key={option.mode}
                              role="radio"
                              aria-checked={active}
                              disabled={!option.enabled}
                              title={option.enabled ? undefined : option.disabledHint}
                              onClick={() => setAddMode(option.mode)}
                              className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active
                                ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-700 dark:text-emerald-400"
                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mb-1.5 truncate px-1 text-[10px] text-slate-400 dark:text-slate-500">
                        {effectiveMode === "child" ? "Inside " : "Next to this node, in "}
                        <span className="font-mono text-slate-500 dark:text-slate-400">{targetName || "root"}</span>
                        {addTargetIsArray ? " (array)" : ""}
                      </div>

                      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Basic</div>
                      <div className="grid grid-cols-3 gap-1">
                        {EMPTY_CHILD_TYPES.map(({ type, label, hint, icon: Icon }) => (
                          <button
                            key={type}
                            className="flex flex-col items-center gap-0.5 rounded-md border border-slate-200 px-1 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-700 dark:border-slate-700/60 dark:text-slate-300 dark:hover:text-emerald-300"
                            title={`Add empty ${label.toLowerCase()} (${hint})`}
                            onClick={() => insertNode(type, "", type)}
                          >
                            <Icon size={14} />
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="mb-1 mt-2 flex items-center justify-between px-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Special nodes</span>
                        {addTargetIsArray && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">need an object</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {SPECIAL_NODE_TYPES.map(({ suffix, label, icon: Icon, iconClass, type, value }) => (
                          <button
                            key={suffix}
                            disabled={addTargetIsArray}
                            className="flex flex-col items-center gap-0.5 rounded-md border border-slate-200 px-1 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent dark:border-slate-700/60 dark:text-slate-300 dark:hover:text-emerald-300 dark:disabled:hover:border-slate-700/60"
                            title={addTargetIsArray
                              ? "Special nodes are identified by their key, so they can only be added to objects"
                              : `Add ${label} node (new_${suffix})`}
                            onClick={() => insertNode(suffix, value, type)}
                          >
                            <Icon size={14} className={iconClass} />
                            {label}
                          </button>
                        ))}
                      </div>

                      {effectiveMode === "child" && (
                        <button
                          className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white flex items-center gap-2"
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
                          <Edit2 size={13} className="text-green-400" />
                          Custom key &amp; value…
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
