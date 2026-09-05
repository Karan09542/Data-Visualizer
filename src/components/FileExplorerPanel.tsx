import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Folder,
  FolderOpen,
  FileCode2,
  Globe,
  Search,
  Plus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Edit2,
  Copy,
  Trash2,
  ExternalLink,
  Info,
  Check,
  X,
  FileText,
  Maximize2,
  CheckSquare,
  Image,
  FoldVertical,
  UnfoldVertical,
} from "lucide-react";
import { useStore } from "../store/useStore";
import {
  getValueAtPath,
  setValueAtPath,
  deleteValueAtPath,
  renameKeyAtPath,
  duplicateValueAtPath,
  moveValueAtPath,
  getParts,
} from "../utils/pathUtils";
import {
  JavaScriptIcon,
  TypeScriptIcon,
  PythonIcon,
  JsonIcon,
  MarkdownIcon,
  TextIcon,
} from "./FileIcons";
import { performWorkspaceRenameScope, cleanNodeName } from "../utils/workspaceIntelliSense";
import { getVirtualPath } from "../utils/vfs";
import { maskParsedData } from "../utils/masker";

interface ExplorerItem {
  id: string; // E.g., 'root.src.user_ts_node'
  name: string; // E.g., 'user.ts'
  realKey: string; // E.g., 'user_ts_node'
  type: "folder" | "js_node" | "ts_node" | "py_node" | "api_node" | "todo_node" | "image_node" | "primitive";
  parentPath: string; // E.g., 'root.src'
  children?: ExplorerItem[];
}

interface FileExplorerPanelProps {
  rootPath?: string;
}

export default function FileExplorerPanel({ rootPath }: FileExplorerPanelProps = {}) {
  const resolvedRootPath = rootPath || "root";

  const parsedData = useStore((state) => state.parsedData);
  const codeFormat = useStore((state) => state.codeFormat);
  const setCode = useStore((state) => state.setCode);
  const expandedJsNodeId = useStore((state) => state.expandedJsNodeId);
  const setExpandedJsNodeId = useStore((state) => state.setExpandedJsNodeId);
  const setSelectedNodeId = useStore((state) => state.setSelectedNodeId);
  const explorerExpandedPaths = useStore((state) => state.explorerExpandedPaths);
  const setExplorerExpandedPath = useStore((state) => state.setExplorerExpandedPath);
  const setAllExplorerExpandedPaths = useStore((state) => state.setAllExplorerExpandedPaths);
  const activeExplorerFile = useStore((state) => state.activeExplorerFile);
  const explorerSearchQuery = useStore((state) => state.explorerSearchQuery);
  const setExplorerSearchQuery = useStore((state) => state.setExplorerSearchQuery);
  const openWorkspaceTab = useStore((state) => state.openWorkspaceTab);
  const closeWorkspaceTabs = useStore((state) => state.closeWorkspaceTabs);
  const updateWorkspaceTabPath = useStore((state) => state.updateWorkspaceTabPath);
  const selectedExplorerFiles = useStore((state) => state.selectedExplorerFiles);
  const setSelectedExplorerFiles = useStore((state) => state.setSelectedExplorerFiles);

  const [searchQuery, setSearchQuery] = useState(explorerSearchQuery);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [creatingInPath, setCreatingInPath] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<"js_node" | "ts_node" | "py_node" | "api_node" | "todo_node" | "image_node" | "folder" | "primitive" | null>(null);
  const [creatingValue, setCreatingValue] = useState("");

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    id: string;
    type: "folder" | "js_node" | "ts_node" | "py_node" | "api_node" | "todo_node" | "image_node" | "primitive";
    name: string;
  } | null>(null);

  // Drag and Drop State
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [deleteItemsConfirm, setDeleteItemsConfirm] = useState<string[] | null>(null);
  const [conflictConfirm, setConflictConfirm] = useState<{
    path: string;
    type: "create" | "rename" | "move" | "paste";
    payload: any;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (explorerError) {
      const timer = setTimeout(() => setExplorerError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [explorerError]);

  // Synchronize local search state with store debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      setExplorerSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, setExplorerSearchQuery]);

  // Focus rename input
  useEffect(() => {
    if (editingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingPath]);

  // Focus create input
  useEffect(() => {
    if (creatingInPath && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [creatingInPath]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

  function isFileSystemMeaningful(value: any): boolean {
    if (typeof value === "string") return true;
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        if (value.length === 0) return false;
        return value.some((item) => {
          if (typeof item === "string") return true;
          if (item && typeof item === "object") return true;
          return false;
        });
      }
      return true;
    }
    return false;
  }

  // Recursively map parsedData keys or properties into Explorer items
  const maskedParsedData = useMemo(() => maskParsedData(parsedData), [parsedData]);

  const fullExplorerTree = useMemo(() => {
    function parseNode(data: any, path: string = resolvedRootPath): ExplorerItem[] {
      if (!data || typeof data !== "object") return [];

      const items: ExplorerItem[] = [];
      const isParentArray = Array.isArray(data);

      for (const [key, value] of Object.entries(data)) {
        if (!isFileSystemMeaningful(value)) {
          continue;
        }

        const currentPath = path === "root" ? `root.${key}` : `${path}.${key}`;

        let displayName = key;
        if (isParentArray) {
          if (typeof value === "string") {
            displayName = value;
          } else if (value && typeof value === "object" && !Array.isArray(value) && typeof (value as any).name === "string") {
            displayName = (value as any).name;
          } else {
            displayName = `[${key}]`;
          }
        }

        const keyLower = key.toLowerCase();
        if (keyLower.endsWith("_js_node")) {
          items.push({
            id: currentPath,
            name: key.replace(/_js_node$/i, ".js"),
            realKey: key,
            type: "js_node",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_py_node")) {
          items.push({
            id: currentPath,
            name: key.replace(/_py_node$/i, ".py"),
            realKey: key,
            type: "py_node", // We reuse py_node type for ExplorerItem to reuse icons and create menus
            parentPath: path,
          });
        } else if (keyLower.endsWith("_ts_node")) {
          items.push({
            id: currentPath,
            name: key.replace(/_ts_node$/i, ".ts"),
            realKey: key,
            type: "ts_node",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_api_node")) {
          items.push({
            id: currentPath,
            name: key.replace(/_api_node$/i, ".api"),
            realKey: key,
            type: "api_node",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_image_node") || keyLower.endsWith(".img")) {
          items.push({
            id: currentPath,
            name: keyLower.endsWith(".img") ? key : key.replace(/_image_node$/i, ".img"),
            realKey: key,
            type: "image_node",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_todo_node") || keyLower.endsWith(".todo")) {
          items.push({
            id: currentPath,
            name: keyLower.endsWith(".todo") ? key : key.replace(/_todo_node$/i, ".todo"),
            realKey: key,
            type: "todo_node",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_json")) {
          items.push({
            id: currentPath,
            name: key.replace(/_json$/i, ".json"),
            realKey: key,
            type: "primitive",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_yaml")) {
          items.push({
            id: currentPath,
            name: key.replace(/_yaml$/i, ".yaml"),
            realKey: key,
            type: "primitive",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_yml")) {
          items.push({
            id: currentPath,
            name: key.replace(/_yml$/i, ".yml"),
            realKey: key,
            type: "primitive",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_csv")) {
          items.push({
            id: currentPath,
            name: key.replace(/_csv$/i, ".csv"),
            realKey: key,
            type: "primitive",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_xml")) {
          items.push({
            id: currentPath,
            name: key.replace(/_xml$/i, ".xml"),
            realKey: key,
            type: "primitive",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_md")) {
          items.push({
            id: currentPath,
            name: key.replace(/_md$/i, ".md"),
            realKey: key,
            type: "primitive",
            parentPath: path,
          });
        } else if (keyLower.endsWith("_txt")) {
          items.push({
            id: currentPath,
            name: key.replace(/_txt$/i, ".txt"),
            realKey: key,
            type: "primitive",
            parentPath: path,
          });
        } else if (typeof value === "object" && value !== null) {
          items.push({
            id: currentPath,
            name: displayName,
            realKey: key,
            type: "folder",
            parentPath: path,
            children: parseNode(value, currentPath),
          });
        } else {
          items.push({
            id: currentPath,
            name: displayName,
            realKey: key,
            type: "primitive",
            parentPath: path,
          });
        }
      }

      // Sort Folders first, then alphabetically
      return items.sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });
    }

    return parseNode(
      resolvedRootPath === "root"
        ? maskedParsedData
        : getValueAtPath(maskedParsedData, resolvedRootPath)
    );
  }, [maskedParsedData, resolvedRootPath]);

  // Filter tree visually based on search query
  const filteredExplorerTree = useMemo(() => {
    if (!explorerSearchQuery.trim()) return fullExplorerTree;

    const query = explorerSearchQuery.toLowerCase().trim();

    function filterBranch(items: ExplorerItem[]): ExplorerItem[] {
      return items
        .map((item) => {
          if (!item) return null;
          try {
            const nameMatches = typeof item.name === 'string' ? item.name.toLowerCase().includes(query) : false;
            const keyMatches = typeof item.realKey === 'string' ? item.realKey.toLowerCase().includes(query) : false;
            const typeMatches = typeof item.type === 'string' ? item.type.toLowerCase().includes(query) : false;

            if (item.type === "folder" && item.children) {
              const filteredChildren = filterBranch(item.children);
              if (filteredChildren.length > 0 || nameMatches || keyMatches) {
                return {
                  ...item,
                  children: filteredChildren,
                };
              }
            }

            if (nameMatches || keyMatches || typeMatches) {
              return item;
            }

            return null;
          } catch (err) {
            console.error("Unable to search this item", item, err);
            return {
              ...item,
              name: "Unable to search this item",
            };
          }
        })
        .filter(Boolean) as ExplorerItem[];
    }

    return filterBranch(fullExplorerTree);
  }, [fullExplorerTree, explorerSearchQuery]);

  // Serialise updated parsedData object back to code format
  const handleSave = async (newData: any) => {
    let newCode = "";
    if (codeFormat === "yaml") {
      try {
        const yaml = (await import("js-yaml")).default;
        newCode = yaml.dump(newData);
      } catch (e) {
        newCode = JSON.stringify(newData, null, 2);
      }
    } else {
      newCode = JSON.stringify(newData, null, 2);
    }
    setCode(newCode);
  };

  // Helper Toast for visual confirmation
  const toastNotification = (msg: string) => {
    // Rely on global styles or show a standard micro-toast inside panel
    // console.log(`[Explorer File System]: ${msg}`);
  };

  // Drag operations
  const handleDragStart = (e: React.DragEvent, id: string) => {
    (window as any).__isInternalDrag = true;
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && draggedId !== id && type === "folder") {
      setDragOverFolderId(id);
    }
  };

  const [moveConfirm, setMoveConfirm] = useState<{ sourceId: string; targetFolderId: string } | null>(null);

  const executeMoveItem = async (sourceId: string, targetFolderId: string) => {
    const sourceKey = sourceId.split(".").pop()!;
    const destPath = targetFolderId === "root" ? `root.${sourceKey}` : `${targetFolderId}.${sourceKey}`;

    // Conflict Check
    if (getValueAtPath(parsedData, destPath) !== undefined) {
      setConflictConfirm({
        path: destPath,
        type: "move",
        payload: { destPath, sourcePath: sourceId, sourceValue: getValueAtPath(parsedData, sourceId) }
      });
      return;
    }

    const updated = moveValueAtPath(parsedData, sourceId, targetFolderId);
    await handleSave(updated);
    toastNotification(`Moved ${sourceKey} to folder ${targetFolderId.split(".").pop()}`);
  }

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    (window as any).__isInternalDrag = false;
    const sourceId = e.dataTransfer.getData("text/plain") || draggedId;
    setDragOverFolderId(null);
    setDraggedId(null);

    if (!sourceId || sourceId === targetFolderId) return;

    // Direct move validation
    if (targetFolderId.startsWith(sourceId)) {
      toastNotification("Cannot move a folder into itself!");
      return;
    }

    if (localStorage.getItem("aistudio_skip_move_confirm") === "true") {
      executeMoveItem(sourceId, targetFolderId);
    } else {
      setMoveConfirm({ sourceId, targetFolderId });
    }
  };

  // Creation Actions
  const handleCreatePrompt = (folderPath: string, type: "js_node" | "ts_node" | "py_node" | "api_node" | "todo_node" | "image_node" | "folder" | "primitive") => {
    setCreatingInPath(folderPath);
    setCreatingType(type);
    setCreatingValue("");
    // Ensure expanded if adding within folder
    if (folderPath !== resolvedRootPath) {
      setExplorerExpandedPath(folderPath, true);
    }
  };

  const handleCreateSubmit = async () => {
    let rawVal = creatingValue.trim();
    if (!rawVal) {
      setCreatingInPath(null);
      setCreatingType(null);
      setCreatingValue("");
      return;
    }

    let actualType = creatingType;
    if (rawVal.endsWith("/")) {
      actualType = "folder";
      rawVal = rawVal.slice(0, -1);
    }

    let finalKey = rawVal;
    let initialValue: any = "";
    if (!actualType) actualType = "primitive";

    if (actualType === "folder") {
      finalKey = rawVal;
      initialValue = {};
      actualType = "folder";
    } else {
      // Dynamic extension-based type detection
      if (rawVal.endsWith(".js") || rawVal.endsWith("_js_node")) {
        const baseName = rawVal.replace(/\.js$/, "").replace(/_js_node$/, "");
        finalKey = `${baseName}_js_node`;
        initialValue = "// JS execution starts here!";
        actualType = "js_node";
      } else if (rawVal.endsWith(".py") || rawVal.endsWith("_py_node")) {
        const baseName = rawVal.replace(/\.py$/, "").replace(/_py_node$/, "");
        finalKey = `${baseName}_py_node`;
        initialValue = "print('Python execution starts here!')";
        actualType = "py_node"; // keep icon generic using the code node execution flow
      } else if (rawVal.endsWith(".ts") || rawVal.endsWith("_ts_node")) {
        const baseName = rawVal.replace(/\.ts$/, "").replace(/_ts_node$/, "");
        finalKey = `${baseName}_ts_node`;
        initialValue = "const msg: string = 'TS execution starts here!';\n";
        actualType = "ts_node";
      } else if (rawVal.endsWith(".api") || rawVal.endsWith("_api_node")) {
        const baseName = rawVal.replace(/\.api$/, "").replace(/_api_node$/, "");
        finalKey = `${baseName}_api_node`;
        initialValue = "https://jsonplaceholder.typicode.com/todos/1";
        actualType = "api_node";
      } else if (rawVal.endsWith(".todo") || rawVal.endsWith("_todo_node")) {
        const baseName = rawVal.replace(/\.todo$/, "").replace(/_todo_node$/, "");
        finalKey = `${baseName}_todo_node`;
        initialValue = JSON.stringify({ title: baseName, tasks: [] });
        actualType = "todo_node";
      } else if (rawVal.endsWith(".img") || rawVal.endsWith("_image_node")) {
        const baseName = rawVal.replace(/\.img$/, "").replace(/_image_node$/, "");
        finalKey = `${baseName}_image_node`;
        initialValue = ""; // Base64 or URL will be stored here later
        actualType = "image_node";
      } else if (rawVal.endsWith(".json") || rawVal.endsWith("_json")) {
        const baseName = rawVal.replace(/\.json$/, "").replace(/_json$/, "");
        finalKey = `${baseName}_json`;
        initialValue = "{\n  \n}";
        actualType = "primitive";
      } else if (rawVal.endsWith(".yaml") || rawVal.endsWith("_yaml")) {
        const baseName = rawVal.replace(/\.yaml$/, "").replace(/_yaml$/, "");
        finalKey = `${baseName}_yaml`;
        initialValue = "";
        actualType = "primitive";
      } else if (rawVal.endsWith(".yml") || rawVal.endsWith("_yml")) {
        const baseName = rawVal.replace(/\.yml$/, "").replace(/_yml$/, "");
        finalKey = `${baseName}_yml`;
        initialValue = "";
        actualType = "primitive";
      } else if (rawVal.endsWith(".csv") || rawVal.endsWith("_csv")) {
        const baseName = rawVal.replace(/\.csv$/, "").replace(/_csv$/, "");
        finalKey = `${baseName}_csv`;
        initialValue = "";
        actualType = "primitive";
      } else if (rawVal.endsWith(".xml") || rawVal.endsWith("_xml")) {
        const baseName = rawVal.replace(/\.xml$/, "").replace(/_xml$/, "");
        finalKey = `${baseName}_xml`;
        initialValue = "";
        actualType = "primitive";
      } else if (rawVal.endsWith(".md") || rawVal.endsWith("_md")) {
        const baseName = rawVal.replace(/\.md$/, "").replace(/_md$/, "");
        finalKey = `${baseName}_md`;
        initialValue = "# Notes\n";
        actualType = "primitive";
      } else if (rawVal.endsWith(".txt") || rawVal.endsWith("_txt")) {
        const baseName = rawVal.replace(/\.txt$/, "").replace(/_txt$/, "");
        finalKey = `${baseName}_txt`;
        initialValue = "";
        actualType = "primitive";
      } else if (rawVal.includes(".")) {
        // Any other standard file extensions fallback
        finalKey = rawVal;
        initialValue = "";
        actualType = "primitive";
      } else {
        // No extension provided - treat as plain text primitive per user instructions
        finalKey = rawVal;
        initialValue = "";
        actualType = "primitive";
      }
    }

    // Prepare path
    const parentDotPath = creatingInPath === "root" ? "root" : creatingInPath!;
    const insertPath = parentDotPath === "root" ? `root.${finalKey}` : `${parentDotPath}.${finalKey}`;

    // Check if key already exists
    const currentLoc = getValueAtPath(parsedData, parentDotPath === "root" ? "" : parentDotPath);
    if (currentLoc && typeof currentLoc === "object" && finalKey in currentLoc) {
      setConflictConfirm({
        path: insertPath,
        type: "create",
        payload: { finalPath: insertPath, initialValue, actualType, parentDotPath }
      });
      setCreatingInPath(null);
      setCreatingType(null);
      setCreatingValue("");
      return;
    }

    executeCreateItem(insertPath, initialValue, actualType, parentDotPath);
  };

  const executeCreateItem = async (finalPath: string, initialValue: any, actualType: string, parentDotPath: string) => {
    const updated = setValueAtPath(parsedData, finalPath, initialValue);
    await handleSave(updated);

    setExplorerExpandedPath(parentDotPath, true);
    if (actualType !== "folder") {
      openWorkspaceTab(finalPath, true);
      setExpandedJsNodeId(finalPath);
    }

    setSelectedNodeId(finalPath);

    setCreatingInPath(null);
    setCreatingType(null);
    setCreatingValue("");
  };

  // Renaming Actions
  const handleRenamePrompt = (item: ExplorerItem) => {
    setEditingPath(item.id);
    let displayName = item.name;
    // Strip extensions in editing if suffix was customized
    setEditingValue(displayName);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Look at selectedExplorerFiles instead of activeExplorerFile (which is just the opened tab)
      const targetRenameId = selectedExplorerFiles && selectedExplorerFiles.length > 0 ? selectedExplorerFiles[0] : activeExplorerFile;

      if (e.key === "F2" && targetRenameId && !editingPath) {
        // Prevent default browser behavior for F2 (though usually safe)
        e.preventDefault();

        // Find the node
        function findNode(nodes: ExplorerItem[], id: string): ExplorerItem | null {
          for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) {
              const found = findNode(n.children, id);
              if (found) return found;
            }
          }
          return null;
        }

        const activeNode = findNode(fullExplorerTree, targetRenameId);
        if (activeNode) {
          handleRenamePrompt(activeNode);
        }
      }
    };

    // Only bind if we're not globally focused in some other input?
    // We'll rely on whether activeExplorerFile is focused or they just press F2.
    // If they are in Monaco editor, Monaco might consume the event, which is fine or maybe not.
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeExplorerFile, selectedExplorerFiles, editingPath, fullExplorerTree]);

  const handleRenameSubmit = async () => {
    if (!editingPath) return;

    const newValue = editingValue.trim();
    if (!newValue) {
      setEditingPath(null);
      return;
    }

    const parts = getParts(editingPath);
    const oldKey = parts[parts.length - 1];
    const parentParts = parts.slice(0, -1);
    const parentPath = parentParts.length > 0 ? `root.${parentParts.join(".")}` : "root";

    let finalNewKey = newValue;
    // Dynamic extension check on renaming
    if (newValue.endsWith(".js") || newValue.endsWith("_js_node")) {
      const baseName = newValue.replace(/\.js$/, "").replace(/_js_node$/, "");
      finalNewKey = `${baseName}_js_node`;
    } else if (newValue.endsWith(".py") || newValue.endsWith("_py_node")) {
      const baseName = newValue.replace(/\.py$/, "").replace(/_py_node$/, "");
      finalNewKey = `${baseName}_py_node`;
    } else if (newValue.endsWith(".ts") || newValue.endsWith("_ts_node")) {
      const baseName = newValue.replace(/\.ts$/, "").replace(/_ts_node$/, "");
      finalNewKey = `${baseName}_ts_node`;
    } else if (newValue.endsWith(".api") || newValue.endsWith("_api_node")) {
      const baseName = newValue.replace(/\.api$/, "").replace(/_api_node$/, "");
      finalNewKey = `${baseName}_api_node`;
    } else if (newValue.endsWith(".todo") || newValue.endsWith("_todo_node")) {
      const baseName = newValue.replace(/\.todo$/, "").replace(/_todo_node$/, "");
      finalNewKey = `${baseName}_todo_node`;
    } else {
      // Keep old type if no new extension specified
      if (editingPath.includes("_js_node")) {
        const baseName = newValue.replace(/\.js$/, "").replace(/_js_node$/, "");
        finalNewKey = `${baseName}_js_node`;
      } else if (editingPath.includes("_py_node")) {
        const baseName = newValue.replace(/\.py$/, "").replace(/_py_node$/, "");
        finalNewKey = `${baseName}_py_node`;
      } else if (editingPath.includes("_ts_node")) {
        const baseName = newValue.replace(/\.ts$/, "").replace(/_ts_node$/, "");
        finalNewKey = `${baseName}_ts_node`;
      } else if (editingPath.includes("_api_node")) {
        const baseName = newValue.replace(/\.api$/, "").replace(/_api_node$/, "");
        finalNewKey = `${baseName}_api_node`;
      } else if (editingPath.includes("_todo_node")) {
        const baseName = newValue.replace(/\.todo$/, "").replace(/_todo_node$/, "");
        finalNewKey = `${baseName}_todo_node`;
      } else {
        finalNewKey = newValue;
      }
    }

    if (oldKey === finalNewKey) {
      setEditingPath(null);
      return;
    }

    // Verify uniqueness
    const currentParentObj = getValueAtPath(parsedData, parentPath === "root" ? "" : parentPath);
    if (currentParentObj && finalNewKey in currentParentObj) {
      setConflictConfirm({
        path: parentPath === "root" ? `root.${finalNewKey}` : `${parentPath}.${finalNewKey}`,
        type: "rename",
        payload: { parentPath, oldKey, finalNewKey, editingPath }
      });
      setEditingPath(null);
      setEditingValue("");
      return;
    }

    executeRenameItem(parentPath, oldKey, finalNewKey, editingPath);
  };

  const executeRenameItem = async (parentPath: string, oldKey: string, finalNewKey: string, editingPath: string) => {
    // Determine absolute VFS paths BEFORE mutation
    const oldVfsPath = getVirtualPath(editingPath, parsedData);

    const updated = renameKeyAtPath(parsedData, parentPath, oldKey, finalNewKey);
    const newPath = parentPath === "root" ? `root.${finalNewKey}` : `${parentPath}.${finalNewKey}`;

    let finalUpdated = updated;
    if (oldVfsPath) {
      const newVfsPath = getVirtualPath(newPath, updated);
      if (newVfsPath && oldVfsPath !== newVfsPath) {
        finalUpdated = performWorkspaceRenameScope(updated, oldVfsPath, newVfsPath);
      }
    }

    await handleSave(finalUpdated);

    // If it was the active file or tab, update
    updateWorkspaceTabPath(editingPath, newPath);

    setEditingPath(null);
    setEditingValue("");
  };

  // Duplication
  const handleDuplicate = async (item: ExplorerItem) => {
    const { newObj, newPath } = duplicateValueAtPath(parsedData, item.id);
    await handleSave(newObj);
    toastNotification(`Duplicated ${item.name}`);
  };

  // Deletion
  const handleDelete = async (item: ExplorerItem) => {
    if (selectedExplorerFiles.includes(item.id) && selectedExplorerFiles.length > 1) {
      setDeleteItemsConfirm(selectedExplorerFiles);
    } else {
      setDeleteItemsConfirm([item.id]);
    }
  };

  // Context Menu operations
  const handleContextMenu = (e: React.MouseEvent, item: ExplorerItem) => {
    e.preventDefault();
    e.stopPropagation();

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const menuWidth = 192; // Assuming w-48
      const menuHeight = 280; // approximate menu height

      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;

      if (x + menuWidth > rect.width) {
        x = rect.width - menuWidth - 5;
      }
      if (y + menuHeight > rect.height) {
        y = Math.max(5, rect.height - menuHeight - 5);
      }

      setContextMenu({
        x,
        y,
        id: item.id,
        type: item.type,
        name: item.name,
      });
    }
  };

  // Toggle Folder expansion list
  const toggleFolder = (folderId: string) => {
    const expanded = !!explorerExpandedPaths[folderId];
    setExplorerExpandedPath(folderId, !expanded);
  };

  // Expand / Collapse Global Folders
  const handleExpandAll = () => {
    const allPaths: Record<string, boolean> = {};
    function gather(items: ExplorerItem[]) {
      for (const item of items) {
        if (item.type === "folder") {
          allPaths[item.id] = true;
          if (item.children) gather(item.children);
        }
      }
    }
    gather(fullExplorerTree);
    setAllExplorerExpandedPaths(allPaths);
  };

  const handleCollapseAll = () => {
    setAllExplorerExpandedPaths({});
  };

  const getVisibleItems = () => {
    const list: string[] = [];
    const traverse = (items: ExplorerItem[]) => {
      for (const item of items) {
        list.push(item.id);
        if (item.type === "folder" && explorerExpandedPaths[item.id] && item.children) {
          traverse(item.children);
        }
      }
    };
    traverse(fullExplorerTree);
    return list;
  };

  const handleItemShiftClick = (item: ExplorerItem) => {
    const visibleItems = getVisibleItems();
    setSelectedExplorerFiles((prev) => {
      const lastSelectedId = prev[prev.length - 1];
      if (!lastSelectedId) return [item.id];
      const startIdx = visibleItems.indexOf(lastSelectedId);
      const endIdx = visibleItems.indexOf(item.id);

      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const newSelectionRange = visibleItems.slice(minIdx, maxIdx + 1);

        // Return existing excluding visible, plus new range
        // Or simply replace the entire selection with the new range to match VS Code purely
        return newSelectionRange;
      }
      return [...prev, item.id];
    });
  };

  // Select/Click file to active item tab
  const handleItemClick = (e: React.MouseEvent, item: ExplorerItem) => {
    e.stopPropagation();

    const isFolder = item.type === "folder";

    if (e.ctrlKey || e.metaKey) {
      // Toggle selection in multi-select
      setSelectedExplorerFiles((prev) =>
        prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
      );
      if (isFolder) toggleFolder(item.id);
      return;
    } else if (e.shiftKey) {
      handleItemShiftClick(item);
      return;
    }

    // Normal click
    setSelectedExplorerFiles([item.id]);

    if (!isFolder) {
      openWorkspaceTab(item.id, true);
      setExpandedJsNodeId(item.id); // Open code workspace for ANY file
    } else {
      toggleFolder(item.id);
      setSelectedNodeId(item.id);
    }
  };

  // Core recursive JSX Renderer for files and directories
  const renderTreeNodes = (items: ExplorerItem[], depth = 0) => {
    return items.map((item) => {
      const isFolder = item.type === "folder";
      const isExpanded = !!explorerExpandedPaths[item.id];
      const isSelected = selectedExplorerFiles.includes(item.id);
      const isEditing = editingPath === item.id;
      const isCreatingInside = creatingInPath === item.id;

      let fileIcon = <FileText size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />;
      if (item.type === "js_node" || item.name.endsWith(".js")) {
        fileIcon = <JavaScriptIcon />;
      } else if (item.type === "py_node" || item.name.endsWith(".py")) {
        fileIcon = <PythonIcon />;
      } else if (item.type === "ts_node" || item.name.endsWith(".ts")) {
        fileIcon = <TypeScriptIcon />;
      } else if (item.type === "api_node" || item.name.endsWith(".api")) {
        fileIcon = <Globe size={16} className="text-sky-500 dark:text-sky-400 shrink-0" />;
      } else if (item.type === "todo_node" || item.name.endsWith(".todo")) {
        fileIcon = <CheckSquare size={16} className="text-blue-500 dark:text-blue-400 shrink-0" />;
      } else if (item.type === "image_node" || item.name.endsWith(".img")) {
        fileIcon = <Image size={16} className="text-purple-500 dark:text-purple-400 shrink-0" />;
      } else if (item.type === "primitive") {
        if (item.name.endsWith(".json")) {
          fileIcon = <JsonIcon />;
        } else if (item.name.endsWith(".md")) {
          fileIcon = <MarkdownIcon />;
        } else if (item.name.endsWith(".txt")) {
          fileIcon = <TextIcon />;
        } else {
          fileIcon = <FileText size={16} className="text-indigo-400 dark:text-indigo-400/95 shrink-0" />;
        }
      }

      const indentPadding = `${depth * 10 + 12}px`;

      return (
        <div key={item.id} className="select-none">
          {/* File Explorer Item list */}
          <div
            draggable={!isEditing}
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragEnd={() => { (window as any).__isInternalDrag = false; setDraggedId(null); setDragOverFolderId(null); }}
            onDragOver={(e) => handleDragOver(e, item.id, item.type)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => isFolder ? handleDrop(e, item.id) : undefined}
            onContextMenu={(e) => handleContextMenu(e, item)}
            onClick={(e) => handleItemClick(e, item)}
            onDoubleClick={(e) => {
              if (!isFolder) {
                e.stopPropagation();
                openWorkspaceTab(item.id, false); // false = not preview
                setExpandedJsNodeId(item.id);
              }
            }}
            style={{ paddingLeft: indentPadding }}
            className={`group flex items-center justify-start h-[22px] cursor-pointer transition-colors text-[13px] border-l-2 select-none relative w-full overflow-hidden ${
              isFolder ? "pr-20" : "pr-8"
            } ${
              isSelected
                ? "bg-[var(--vsc-selection,#e4e6f1)] border-l-[var(--vsc-accent,#005fb8)] text-[var(--vsc-fg,#3b3b3b)]"
                : "border-l-transparent text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))]"
            } ${dragOverFolderId === item.id ? "!bg-emerald-500/10 outline outline-1 outline-dashed outline-emerald-500 rounded-[3px]" : ""}`}
          >
            {/* Indent guides, as in the VS Code file tree */}
            {Array.from({ length: depth }).map((_, d) => (
              <span
                key={d}
                aria-hidden
                className="absolute top-0 bottom-0 w-px bg-[var(--vsc-border,#e5e5e5)] opacity-70 pointer-events-none"
                style={{ left: `${d * 10 + 17}px` }}
              />
            ))}

            <div className="flex items-center gap-2 pr-2 min-w-0 flex-1">
              {isFolder ? (
                <>
                  <span className="text-[var(--vsc-fg-muted,#616161)] shrink-0">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span className="text-amber-500 dark:text-amber-400 shrink-0">
                    {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                  </span>
                </>
              ) : (
                <span className="pl-[20px] shrink-0">{fileIcon}</span>
              )}

              {isEditing ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") setEditingPath(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-xs font-mono px-1 py-0.5 bg-white dark:bg-[#121824] border border-blue-500 rounded outline-none text-slate-800 dark:text-slate-200"
                />
              ) : (
                <span className="truncate" title={item.name}>{item.name}</span>
              )}
            </div>

            {/* Quick Action icon triggers */}
            <div
              className={`hidden group-hover:flex focus-within:flex items-center gap-0.5 pl-3 pr-1.5 h-full absolute right-0 top-0 z-10 ${isSelected ? "bg-[var(--vsc-selection,#e4e6f1)]" : "bg-[var(--vsc-row-actions,#f0f0f0)]"}`}
            >
              {isFolder && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreatePrompt(item.id, "primitive");
                    }}
                    title="New File"
                    className="p-0.5 rounded-[3px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-active,rgba(0,0,0,0.1))] transition cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreatePrompt(item.id, "folder");
                    }}
                    title="New Folder"
                    className="p-0.5 rounded-[3px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-active,rgba(0,0,0,0.1))] transition cursor-pointer"
                  >
                    <FolderPlus size={13} />
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const targetRect = e.currentTarget.getBoundingClientRect();
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const menuWidth = 220;
                    const menuHeight = 280;

                    let x = targetRect.left - rect.left - 120;
                    let y = targetRect.top - rect.top + 20;

                    if (x + menuWidth > rect.width) {
                      x = rect.width - menuWidth - 5;
                    }
                    if (y + menuHeight > rect.height) {
                      y = Math.max(5, rect.height - menuHeight - 5);
                    }

                    setContextMenu({
                      x,
                      y,
                      id: item.id,
                      type: item.type,
                      name: item.name,
                    });
                  }
                }}
                className="p-0.5 rounded-[3px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-active,rgba(0,0,0,0.1))] transition cursor-pointer"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          </div>

          {/* Creation input inside folder */}
          {isFolder && isExpanded && isCreatingInside && (
            <div
              style={{ paddingLeft: `${(depth + 1) * 10 + 12}px` }}
              className="flex items-center gap-1.5 py-1 pr-2 border border-transparent"
            >
              <span className="shrink-0">
                {creatingType === "folder" ? (
                  <Folder size={14} className="text-amber-450 dark:text-amber-400/90" />
                ) : creatingType === "ts_node" ? (
                  <FileCode2 size={14} className="text-blue-500" />
                ) : creatingType === "py_node" ? (
                  <FileCode2 size={14} className="text-emerald-500" />
                ) : creatingType === "js_node" ? (
                  <FileCode2 size={14} className="text-amber-500" />
                ) : (
                  <Globe size={14} className="text-sky-500" />
                )}
              </span>
              <input
                ref={createInputRef}
                type="text"
                value={creatingValue}
                onChange={(e) => setCreatingValue(e.target.value)}
                onBlur={handleCreateSubmit}
                placeholder={
                  creatingType === "folder"
                    ? "folder name"
                    : "filename.ts, .js, .json, .txt..."
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSubmit();
                  if (e.key === "Escape") {
                    setCreatingInPath(null);
                    setCreatingType(null);
                  }
                }}
                className="w-full text-xs font-mono px-1 py-0.5 bg-white dark:bg-[#121824] border border-emerald-500 rounded outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-655"
              />
            </div>
          )}

          {/* Recursive subtree */}
          {isFolder && isExpanded && item.children && item.children.length > 0 && (
            <div className="border-l border-slate-200 dark:border-slate-800/80 ml-[23px]">
              {renderTreeNodes(item.children, depth + 1)}
            </div>
          )}

          {/* Empty folder spacer placeholder */}
          {isFolder && isExpanded && (!item.children || item.children.length === 0) && !isCreatingInside && (
            <div
              style={{ paddingLeft: `${(depth + 1) * 12 + 30}px` }}
              className="py-1 text-[10px] text-slate-400 dark:text-slate-500 italic font-mono"
            >
              empty folder
            </div>
          )}
        </div>
      );
    });
  };

  const activeNodeMenu = contextMenu && fullExplorerTree.length > 0 ? (
    (() => {
      function findNode(nodes: ExplorerItem[], id: string): ExplorerItem | null {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children) {
            const found = findNode(n.children, id);
            if (found) return found;
          }
        }
        return null;
      }
      return findNode(fullExplorerTree, contextMenu.id);
    })()
  ) : null;

  return (
    <div
      ref={containerRef}
      onKeyDown={(e) => {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
          return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && selectedExplorerFiles.length > 0) {
          setDeleteItemsConfirm(selectedExplorerFiles);
        }
        if (e.key === "F2" && selectedExplorerFiles.length === 1) {
          e.preventDefault();
          const targetId = selectedExplorerFiles[0];
          const node = fullExplorerTree.find(n => n.id === targetId);
          if (node) {
            handleRenamePrompt(node);
          }
        }
      }}
      tabIndex={-1}
      onClick={() => setSelectedExplorerFiles([])}
      className="flex flex-col h-full bg-[var(--vsc-sidebar,#f8fafc)] text-[var(--vsc-fg,#3b3b3b)] relative overflow-hidden flex-1 select-none outline-none"
    >
      {/* Visual File Explorer Header controls */}
      <div className="pl-4 pr-2 h-[26px] flex items-center justify-between gap-1 shrink-0 group/section">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <ChevronDown size={14} className="text-[var(--vsc-fg-muted,#616161)] shrink-0" />
          <h2 className="text-[11px] font-bold text-[var(--vsc-fg,#3b3b3b)] uppercase tracking-wide leading-none truncate" title={resolvedRootPath === "root" ? "Workspace Files" : resolvedRootPath}>
            {resolvedRootPath === "root" ? "Workspace Files" : resolvedRootPath.split(".").pop()}
          </h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleCreatePrompt(resolvedRootPath, "primitive")}
            title="New File"
            className="p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition cursor-pointer"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => handleCreatePrompt(resolvedRootPath, "folder")}
            title="New Folder"
            className="p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition cursor-pointer"
          >
            <FolderPlus size={14} />
          </button>
          <div className="h-3 w-px bg-[var(--vsc-border,#e5e5e5)] mx-1" />
          <button
            onClick={() => {
              const hasAnyExpanded = Object.values(explorerExpandedPaths).some(Boolean);
              if (hasAnyExpanded) {
                handleCollapseAll();
              } else {
                handleExpandAll();
              }
            }}
            title={Object.values(explorerExpandedPaths).some(Boolean) ? "Collapse All Folders" : "Expand All Folders"}
            className="p-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition cursor-pointer"
          >
            {Object.values(explorerExpandedPaths).some(Boolean) ? (
              <FoldVertical size={14} />
            ) : (
              <UnfoldVertical size={14} />
            )}
          </button>
        </div>
      </div>

      {/* SEARCH / INSTANT FILTER INPUT */}
      <div className="px-3 pb-2 pt-1 shrink-0">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none">
            <Search size={13} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files, folders or nodes..."
            className="w-full text-xs pl-8 pr-6 py-1 bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] rounded-[3px] focus:outline-none focus:ring-1 focus:ring-[var(--vsc-accent,#005fb8)] text-[var(--vsc-fg,#3b3b3b)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {explorerError && (
        <div className="mx-2 mt-2 p-2 bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs rounded-md flex items-center justify-between shadow-xs border-dashed">
          <span className="truncate pr-1 font-sans">{explorerError}</span>
          <button
            onClick={() => setExplorerError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300 p-0.5 ml-1 select-none cursor-pointer shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* CORE TREE CANVAS AREA */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-1" 
        onClick={() => setSelectedExplorerFiles([])}
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCreatePrompt(resolvedRootPath, "primitive");
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedId) {
            setDragOverFolderId("root");
          }
        }}
        onDragLeave={() => {
          setDragOverFolderId(null);
        }}
        onDrop={(e) => {
          if (draggedId) handleDrop(e, "root");
        }}
      >
        {creatingInPath === resolvedRootPath && creatingType && (
          <div className="flex items-center gap-1.5 py-1 px-2.5 bg-slate-50 dark:bg-slate-800/20 rounded">
            <span className="shrink-0">
              {creatingType === "folder" ? (
                <Folder size={14} className="text-amber-500" />
              ) : creatingType === "ts_node" ? (
                <FileCode2 size={14} className="text-blue-500" />
              ) : creatingType === "py_node" ? (
                <FileCode2 size={14} className="text-emerald-500" />
              ) : creatingType === "js_node" ? (
                <FileCode2 size={14} className="text-amber-300" />
              ) : (
                <Globe size={14} className="text-sky-500" />
              )}
            </span>
            <input
              ref={createInputRef}
              type="text"
              value={creatingValue}
              onChange={(e) => setCreatingValue(e.target.value)}
              onBlur={handleCreateSubmit}
              placeholder={
                creatingType === "folder"
                  ? "folder name"
                  : "filename.ts, .js, .json, .txt..."
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSubmit();
                if (e.key === "Escape") {
                  setCreatingInPath(null);
                  setCreatingType(null);
                }
              }}
              className="w-full text-xs font-mono px-1 py-0.5 bg-white dark:bg-[#121824] border border-blue-500 rounded outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-555"
            />
          </div>
        )}

        {filteredExplorerTree.length > 0 ? (
          renderTreeNodes(filteredExplorerTree)
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-5 text-center text-slate-400 dark:text-slate-500">
            <FileText size={24} className="opacity-40 mb-3" />
            <span className="text-xs font-mono font-medium">No workspace nodes match.</span>
            <button
              onClick={() => handleCreatePrompt(resolvedRootPath, "ts_node")}
              className="mt-3 text-xs text-blue-550 dark:text-blue-400 font-semibold hover:underline"
            >
              + Create Node File
            </button>
          </div>
        )}
      </div>

      {/* WORKSPACE PERSISTENCE SYNC FOOTER */}
      <div className="px-3 py-1 border-t border-[var(--vsc-border,#e5e5e5)] flex items-center justify-between shrink-0 text-[10px] text-[var(--vsc-fg-muted,#616161)]">
        <span className="truncate flex items-center gap-1 text-[9.5px]">
          <Info size={10} className="text-indigo-400 shrink-0" />
          <span>Syncing graph state</span>
        </span>
        <span className="shrink-0 text-emerald-500 font-semibold select-none flex items-center gap-0.5">
          <Check size={10} /> Saved
        </span>
      </div>

      {/* VS Code Rich Context Menu popup */}
      <AnimatePresence>
        {contextMenu && activeNodeMenu && (
          <>
            {/* Backdrop to dismiss */}
            <div
              className="fixed inset-0 z-[500]"
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu(null);
              }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              style={{
                top: `${contextMenu.y}px`,
                left: `${contextMenu.x}px`,
              }}
              className="absolute z-[550] w-[220px] py-1 bg-[var(--vsc-widget,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] rounded-[5px] shadow-[0_4px_18px_var(--vsc-widget-shadow,rgba(0,0,0,0.16))] outline-none font-sans"
            >
              <div className="px-3 py-1 border-b border-[var(--vsc-border,#e5e5e5)] mb-1">
                <p className="text-[10px] font-semibold tracking-wider text-[var(--vsc-fg-muted,#616161)] uppercase truncate">
                  {contextMenu.name}
                </p>
              </div>

              {/* Standard Operations */}
              {(contextMenu.type === "js_node" || contextMenu.type === "ts_node" || contextMenu.type === "py_node") && (
                <button
                  onClick={() => {
                    openWorkspaceTab(activeNodeMenu.id, false);
                    setExpandedJsNodeId(activeNodeMenu.id);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-accent,#005fb8)] hover:text-[var(--vsc-accent-fg,#ffffff)] transition-colors cursor-pointer"
                >
                  <ExternalLink size={13} className="shrink-0 opacity-80" />
                  <span>Open in Workspace</span>
                </button>
              )}

              {contextMenu.type === "folder" && (
                <>
                  <button
                    onClick={() => {
                      handleCreatePrompt(activeNodeMenu.id, "primitive");
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-accent,#005fb8)] hover:text-[var(--vsc-accent-fg,#ffffff)] transition-colors cursor-pointer"
                  >
                    <Plus size={13} className="shrink-0 opacity-80" />
                    <span>New File</span>
                  </button>
                  <button
                    onClick={() => {
                      handleCreatePrompt(activeNodeMenu.id, "folder");
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-accent,#005fb8)] hover:text-[var(--vsc-accent-fg,#ffffff)] transition-colors cursor-pointer"
                  >
                    <FolderPlus size={13} className="shrink-0 opacity-80" />
                    <span>New Subfolder</span>
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  handleRenamePrompt(activeNodeMenu);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-accent,#005fb8)] hover:text-[var(--vsc-accent-fg,#ffffff)] transition-colors cursor-pointer"
              >
                <Edit2 size={13} className="shrink-0 opacity-80" />
                <span>Rename Item</span>
              </button>

              <button
                onClick={() => {
                  handleDuplicate(activeNodeMenu);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-accent,#005fb8)] hover:text-[var(--vsc-accent-fg,#ffffff)] transition-colors cursor-pointer"
              >
                <Copy size={13} className="shrink-0 opacity-80" />
                <span>Duplicate Node</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeNodeMenu.name);
                  setContextMenu(null);
                  toastNotification("Copied item name to clipboard");
                }}
                className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-accent,#005fb8)] hover:text-[var(--vsc-accent-fg,#ffffff)] transition-colors cursor-pointer"
              >
                <Copy size={13} className="shrink-0 opacity-80" />
                <span>Copy Name</span>
              </button>

              <button
                onClick={() => {
                  const cleanedPath = activeNodeMenu.id.replace(/^root\.?/, "");
                  navigator.clipboard.writeText(cleanedPath);
                  setContextMenu(null);
                  toastNotification(`Copied path "${cleanedPath}" to clipboard`);
                }}
                className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-accent,#005fb8)] hover:text-[var(--vsc-accent-fg,#ffffff)] transition-colors cursor-pointer"
              >
                <Copy size={13} className="shrink-0 opacity-80" />
                <span>Copy Path</span>
              </button>

              <button
                onClick={() => {
                  setSelectedNodeId(activeNodeMenu.id);
                  setContextMenu(null);
                  setExpandedJsNodeId(null);
                  toastNotification(`Highlighted ${activeNodeMenu.name} in graph`);
                }}
                className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-accent,#005fb8)] hover:text-[var(--vsc-accent-fg,#ffffff)] transition-colors cursor-pointer"
              >
                <Maximize2 size={13} className="shrink-0 opacity-80" />
                <span>Reveal in Graph</span>
              </button>

              <div className="h-px bg-[var(--vsc-border,#e5e5e5)] my-1" />

              <button
                onClick={() => {
                  handleDelete(activeNodeMenu);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 h-[22px] text-left text-[13px] text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
              >
                <Trash2 size={13} className="shrink-0 opacity-90" />
                <span>Delete Node</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRM DELETE DIALOG */}
      <AnimatePresence>
        {deleteItemsConfirm && (
          <div className="absolute inset-0 z-[600] bg-black/40 dark:bg-black/60 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="bg-[var(--vsc-widget,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] p-4 rounded-[6px] shadow-[0_8px_28px_var(--vsc-widget-shadow,rgba(0,0,0,0.16))] w-full max-w-[280px] text-center"
            >
              <h3 className="text-[13px] font-semibold text-[var(--vsc-fg,#3b3b3b)] mb-1.5">
                Delete Node{deleteItemsConfirm.length > 1 ? "s" : ""}?
              </h3>
              <p className="text-[12px] text-[var(--vsc-fg-muted,#616161)] mb-4 truncate" title={deleteItemsConfirm.length > 1 ? deleteItemsConfirm.join(", ") : typeof deleteItemsConfirm[0] === 'string' ? deleteItemsConfirm[0].split(".").pop()?.replace(/_(js|ts|py|api)_node$/, "") : ""}>
                {deleteItemsConfirm.length > 1 ? `Remove ${deleteItemsConfirm.length} items?` : `Remove "${typeof deleteItemsConfirm[0] === 'string' ? deleteItemsConfirm[0].split(".").pop()?.replace(/_(js|ts|py|api)_node$/, "") : ""}"?`} This cannot be undone.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setDeleteItemsConfirm(null)}
                  className="px-4 py-1 text-[13px] bg-[var(--vsc-input,#ffffff)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] text-[var(--vsc-fg,#3b3b3b)] rounded-[3px] border border-[var(--vsc-border-strong,#cecece)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const ids = deleteItemsConfirm;
                    setDeleteItemsConfirm(null);
                    let currentData = parsedData;
                    for (const id of ids) {
                      currentData = deleteValueAtPath(currentData, id);
                    }
                    await handleSave(currentData);

                    closeWorkspaceTabs(ids);
                    if (expandedJsNodeId && ids.includes(expandedJsNodeId)) {
                      setExpandedJsNodeId(null);
                    }
                    setSelectedExplorerFiles([]);
                    toastNotification(`Deleted ${ids.length} node(s)`);
                  }}
                  className="px-4 py-1 text-[13px] bg-red-600 hover:bg-red-700 text-white rounded-[3px] transition cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {conflictConfirm && (
          <div className="absolute inset-0 z-[600] bg-black/40 dark:bg-black/60 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="bg-[var(--vsc-widget,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] p-4 rounded-[6px] shadow-[0_8px_28px_var(--vsc-widget-shadow,rgba(0,0,0,0.16))] w-full max-w-[280px] text-center"
            >
              <h3 className="text-[13px] font-semibold text-[var(--vsc-fg,#3b3b3b)] mb-1.5">
                Naming Conflict
              </h3>
              <p className="text-[12px] text-[var(--vsc-fg-muted,#616161)] mb-4">
                A file or folder named "{conflictConfirm.path.split('.').pop()}" already exists.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setConflictConfirm(null)}
                  className="px-4 py-1 text-[13px] bg-[var(--vsc-input,#ffffff)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] text-[var(--vsc-fg,#3b3b3b)] rounded-[3px] border border-[var(--vsc-border-strong,#cecece)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const c = conflictConfirm;
                    setConflictConfirm(null);
                    if (c.type === "create") {
                      executeCreateItem(c.payload.finalPath, c.payload.initialValue, c.payload.actualType, c.payload.parentDotPath);
                    } else if (c.type === "rename") {
                      executeRenameItem(c.payload.parentPath, c.payload.oldKey, c.payload.finalNewKey, c.payload.editingPath);
                    } else if (c.type === "move" || c.type === "paste") {
                      // handle move conflict directly
                      const updated = setValueAtPath(parsedData, c.payload.destPath, c.payload.sourceValue);
                      const finalUpdated = deleteValueAtPath(updated, c.payload.sourcePath);
                      await handleSave(finalUpdated);
                      updateWorkspaceTabPath(c.payload.sourcePath, c.payload.destPath);
                    } else if (c.type === "duplicate") {
                      const updated = setValueAtPath(parsedData, c.payload.destPath, c.payload.sourceValue);
                      await handleSave(updated);
                    }
                  }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#3498db] hover:bg-[#2980b9] text-white rounded-md transition cursor-pointer"
                >
                  Replace
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {moveConfirm && (
          <div className="absolute inset-0 z-[600] bg-black/40 dark:bg-black/60 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="bg-[#f3f3f3] dark:bg-[#252526] border border-slate-300 dark:border-[#454545] rounded-md shadow-2xl w-full max-w-[400px] text-left overflow-hidden flex flex-col font-sans"
            >
              <div className="px-4 py-2 bg-white dark:bg-[#333333] flex justify-between items-center text-[13px] text-slate-800 dark:text-slate-200">
                Code Editor
                <button onClick={() => setMoveConfirm(null)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  <X size={16} />
                </button>
              </div>

              <div className="px-4 py-6 flex gap-4 bg-white dark:bg-[#252526]">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-full bg-[#1e88e5] text-white flex items-center justify-center">
                    <Info size={24} />
                  </div>
                </div>
                <div className="flex-1 mt-2 text-[14px] text-slate-800 dark:text-slate-200">
                  Are you sure you want to move '{moveConfirm.sourceId.split(".").pop()}' into '{moveConfirm.targetFolderId.split(".").pop()}'?
                </div>
              </div>

              <div className="px-4 pb-4 pt-1 flex items-center justify-between bg-white dark:bg-[#252526]">
                <label className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700 dark:text-slate-300">
                  <input type="checkbox" id="skip_move_confirm" className="rounded border-slate-400 dark:border-slate-500 bg-transparent w-3.5 h-3.5 cursor-pointer" />
                  <span>Do not ask me again</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const skip = (document.getElementById('skip_move_confirm') as HTMLInputElement)?.checked;
                      if (skip) localStorage.setItem("aistudio_skip_move_confirm", "true");
                      const src = moveConfirm.sourceId;
                      const tgt = moveConfirm.targetFolderId;
                      setMoveConfirm(null);
                      await executeMoveItem(src, tgt);
                    }}
                    className="px-4 py-1.5 text-[13px] font-medium bg-transparent hover:bg-blue-50 dark:hover:bg-blue-500/10 text-[#007acc] dark:text-[#3794ff] border border-[#007acc] dark:border-[#3794ff] rounded outline-none transition cursor-pointer"
                  >
                    Move
                  </button>
                  <button
                    onClick={() => setMoveConfirm(null)}
                    className="px-4 py-1.5 text-[13px] font-medium bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 outline-none rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
