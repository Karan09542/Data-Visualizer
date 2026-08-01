import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import {
  Plus,
  Trash2,
  Search,
  Check,
  X,
  Settings,
  Type,
  Hash,
  ToggleLeft,
  Braces,
  ListOrdered,
  AlertCircle,
  FolderPlus,
  Tag,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Copy,
  Edit3,
  Move,
  Folder,
  Menu,
  Globe,
  FileCode,
  Calculator,
  CheckSquare,
  ImageIcon,
  ArrowRightLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LeafField {
  path: string; // e.g. "root.project", "root.settings.theme"
  parentPath: string; // e.g. "root" or "root.settings"
  keyName: string; // e.g. "project" or "theme"
  value: any;
  type: "string" | "number" | "boolean" | "array" | "object";
}

export default function GuiEditorPanel() {
  const { codeFormat, code, setCode, parsedData, appTheme, setSelectedNodeId } = useStore();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Internal visual modes
  const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>(
    {},
  );

  // Editor Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // Bottom sheet or full drawer on mobile trigger
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Selected Type for new field
  const [newKeyType, setNewKeyType] = useState<
    "string" | "number" | "boolean" | "array" | "object" | "api_node" | "js_node" | "ts_node" | "py_node" | "math_node" | "todo_node" | "image_node" | "transfer_node" | "search_node"
  >("string");
  const [newParentPath, setNewParentPath] = useState<string>("root");
  const [newKeyName, setNewKeyName] = useState<string>("");

  // Type-specific values for new field
  const [textValue, setTextValue] = useState<string>("");
  const [numberValue, setNumberValue] = useState<number>(0);
  const [booleanValue, setBooleanValue] = useState<boolean>(true);

  // Inline edit state for values
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>("");
  const [editingNumValue, setEditingNumValue] = useState<number>(0);
  const [editingBoolValue, setEditingBoolValue] = useState<boolean>(true);

  // Inline renaming key state
  const [renamingPath, setRenamingPath] = useState<string | null>(0 as any); // path string or null
  const [newKeyRenameValue, setNewKeyRenameValue] = useState<string>("");

  // Relocation state
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [moveToPath, setMoveToPath] = useState<string>("root");

  // Multi-action Dropdown Menu State
  const [activeMenuPath, setActiveMenuPath] = useState<string | null>(null);

  // In-line confirm delete path to avoid raw browser alerts
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(
    null,
  );

  // Undo/Redo tracking history specific to GUI actions
  const [guiHistory, setGuiHistory] = useState<string[]>([]);
  const [guiRedo, setGuiRedo] = useState<string[]>([]);

  // Validation / Error Notification state
  const [formError, setFormError] = useState<string>("");
  const [toastNotification, setToastNotification] = useState<{
    id: number;
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);

  // Array element editing & management state
  const [editingArrayElementPath, setEditingArrayElementPath] = useState<string | null>(null);
  const [editingArrayElementVal, setEditingArrayElementVal] = useState<any>("");
  const [editingArrayElementType, setEditingArrayElementType] = useState<"string" | "number" | "boolean">("string");
  const [newArrayElementInputs, setNewArrayElementInputs] = useState<Record<string, { value: string; type: "string" | "number" | "boolean" | "null" | "array" | "object"; key?: string }>>({});

  // Handlers for managing list/array elements
  const handleAddObjectProperty = (objectPath: string) => {
    const input = newArrayElementInputs[objectPath] || { value: "", type: "string", key: "" };
    if (!input.key || input.key.trim() === "") {
        triggerToast("Please provide a valid key name", "error");
        return;
    }
    
    let finalVal: any = input.value;
    if (input.type === "number") finalVal = Number(input.value) || 0;
    if (input.type === "boolean") finalVal = input.value === "true" || input.value === "True";
    if (input.type === "null") finalVal = null;
    if (input.type === "object") finalVal = {};
    if (input.type === "array") finalVal = [];

    const updatedData = parsedData ? JSON.parse(JSON.stringify(parsedData)) : {};
    const parts = objectPath.split(".");
    if (parts[0] === "root") parts.shift(); // remove 'root'

    let target = updatedData;
    for (const p of parts) {
      if (target) target = target[p];
    }

    if (target && typeof target === "object" && !Array.isArray(target)) {
      if (input.key in target) {
          triggerToast(`Key "${input.key}" already exists`, "error");
          return;
      }
      snapshotHistory();
      target[input.key] = finalVal;
      saveUpdatedData(updatedData);
      triggerToast("Added property to object", "success");
      setNewArrayElementInputs((prev) => ({
        ...prev,
        [objectPath]: { value: "", type: "string", key: "" },
      }));
      setSelectedNodeId(objectPath === "root" ? `root.${input.key}` : `${objectPath}.${input.key}`);
    }
  };

  const handleAddArrayElement = (arrayPath: string) => {
    const input = newArrayElementInputs[arrayPath] || { value: "", type: "string" };
    let finalVal: any = input.value;
    if (input.type === "number") finalVal = Number(input.value) || 0;
    if (input.type === "boolean") finalVal = input.value === "true" || input.value === "True";
    if (input.type === "null") finalVal = null;
    if (input.type === "object") finalVal = {};
    if (input.type === "array") finalVal = [];

    const updatedData = parsedData ? JSON.parse(JSON.stringify(parsedData)) : {};
    const parts = arrayPath.split(".");
    parts.shift(); // remove 'root'

    let target = updatedData;
    for (const p of parts) {
      if (target) target = target[p];
    }

    if (Array.isArray(target)) {
      snapshotHistory();
      target.push(finalVal);
      saveUpdatedData(updatedData);
      triggerToast("Added element to array", "success");
      setNewArrayElementInputs((prev) => ({
        ...prev,
        [arrayPath]: { value: "", type: "string" },
      }));
      setSelectedNodeId(`${arrayPath}[${target.length - 1}]`);
    }
  };

  const handleDeleteArrayElement = (arrayPath: string, index: number) => {
    const updatedData = parsedData ? JSON.parse(JSON.stringify(parsedData)) : {};
    const parts = arrayPath.split(".");
    parts.shift(); // remove 'root'

    let target = updatedData;
    for (const p of parts) {
      if (target) target = target[p];
    }

    if (Array.isArray(target)) {
      snapshotHistory();
      target.splice(index, 1);
      saveUpdatedData(updatedData);
      triggerToast("Removed item", "info");
    }
  };

  const handleUpdateArrayElement = (arrayPath: string, index: number) => {
    const updatedData = parsedData ? JSON.parse(JSON.stringify(parsedData)) : {};
    const parts = arrayPath.split(".");
    parts.shift(); // remove 'root'

    let target = updatedData;
    for (const p of parts) {
      if (target) target = target[p];
    }

    if (Array.isArray(target)) {
      snapshotHistory();
      let newVal: any = editingArrayElementVal;
      if (editingArrayElementType === "number") newVal = Number(editingArrayElementVal) || 0;
      if (editingArrayElementType === "boolean") {
        newVal = editingArrayElementVal === true || editingArrayElementVal === "true" || editingArrayElementVal === "True";
      }

      target[index] = newVal;
      saveUpdatedData(updatedData);
      triggerToast("Updated list item", "success");
      setEditingArrayElementPath(null);
    }
  };

  const handleMoveArrayElement = (arrayPath: string, index: number, direction: "up" | "down") => {
    const updatedData = parsedData ? JSON.parse(JSON.stringify(parsedData)) : {};
    const parts = arrayPath.split(".");
    parts.shift(); // remove 'root'

    let target = updatedData;
    for (const p of parts) {
      if (target) target = target[p];
    }

    if (Array.isArray(target)) {
      const targetIndex = index + (direction === "up" ? -1 : 1);
      if (targetIndex >= 0 && targetIndex < target.length) {
        snapshotHistory();
        const temp = target[index];
        target[index] = target[targetIndex];
        target[targetIndex] = temp;
        saveUpdatedData(updatedData);
        triggerToast(`Moved element ${direction}`, "success");
      }
    }
  };

  // Ref container to close dropdown menus when clicked outside
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setActiveMenuPath(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Hotkey support `Ctrl+Z` to undo visual actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field or interactive form element
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInputFocused) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        triggerUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        triggerRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [guiHistory, guiRedo, code]);

  // Create elegant toast feedback
  const triggerToast = (
    message: string,
    type: "success" | "info" | "error" = "success",
  ) => {
    const id = Date.now();
    setToastNotification({ id, message, type });
    setTimeout(() => {
      setToastNotification((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  };

  // Push code to visual history stack before applying visual model change
  const snapshotHistory = () => {
    setGuiHistory((prev) => [...prev, code]);
    setGuiRedo([]); // clear redo
  };

  const triggerUndo = () => {
    if (guiHistory.length > 0) {
      const precedingCode = guiHistory[guiHistory.length - 1];
      setGuiHistory((prev) => prev.slice(0, prev.length - 1));
      setGuiRedo((prev) => [code, ...prev]);
      setCode(precedingCode);
      triggerToast("Action undone", "info");
    } else {
      triggerToast("Nothing left to undo", "info");
    }
  };

  const triggerRedo = () => {
    if (guiRedo.length > 0) {
      const subsequentCode = guiRedo[0];
      setGuiRedo((prev) => prev.slice(1));
      setGuiHistory((prev) => [...prev, code]);
      setCode(subsequentCode);
      triggerToast("Action redone", "info");
    } else {
      triggerToast("Nothing left to redo", "info");
    }
  };

  // 1. Recursive list of current directories where nested keys can be added
  const objectPaths = useMemo(() => {
    function getObjectPaths(
      obj: any,
      currentPath = "root",
    ): { path: string; label: string }[] {
      const paths: { path: string; label: string }[] = [
        { path: currentPath, label: currentPath === "root" ? "root (Top Level)" : currentPath },
      ];
      if (obj && typeof obj === "object") {
        const keys = Object.keys(obj);
        for (const key of keys) {
          const val = obj[key as keyof typeof obj];
          if (val && typeof val === "object") {
            const nestedPath =
              currentPath === "root" ? `root.${key}` : `${currentPath}.${key}`;
            paths.push(...getObjectPaths(val, nestedPath));
          }
        }
      }
      return paths;
    }
    return getObjectPaths(parsedData || {});
  }, [parsedData]);

  // 2. Linear traversal of elements with depth, pathing metadata for rich hierarchy
  const allFields = useMemo(() => {
    function getFields(
      obj: any,
      currentPath = "root",
      parentPath = "",
    ): LeafField[] {
      const fields: LeafField[] = [];
      if (obj !== null && typeof obj === "object") {
        for (const key of Object.keys(obj)) {
          const val = obj[key as keyof typeof obj];
          const nestedPath =
            currentPath === "root" ? `root.${key}` : `${currentPath}.${key}`;
          const isArr = Array.isArray(val);
          const isObj = val !== null && typeof val === "object" && !isArr;
          const isNull = val === null;
          const itemType = isNull ? "null" : isArr
            ? "array"
            : isObj
              ? "object"
              : (typeof val as "string" | "number" | "boolean");

          fields.push({
            path: nestedPath,
            parentPath: currentPath,
            keyName: key,
            value: val,
            type: itemType as any,
          });

          if (isObj || isArr) {
            fields.push(...getFields(val, nestedPath, currentPath));
          }
        }
      }
      return fields;
    }
    return getFields(parsedData || {});
  }, [parsedData]);

  // Helper check to see if an element's ancestors are collapsed in Tree mode
  const isPathVisible = (fieldPath: string) => {
    if (viewMode === "flat") return true;
    const parts = fieldPath.split(".");
    let current = parts[0];
    for (let i = 1; i < parts.length - 1; i++) {
      current = `${current}.${parts[i]}`;
      if (collapsedPaths[current]) {
        return false;
      }
    }
    return true;
  };

  // Convert depth levels based on dot segments (e.g., 'root.settings.theme' -> level 2)
  const getFieldDepth = (fieldPath: string) => {
    return Math.max(0, fieldPath.split(".").length - 2);
  };

  // Universal updater to serialise state to code (resolves and handles YAML/JSON securely)
  const saveUpdatedData = async (newData: any) => {
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

  // 4. CRUD: Add new key
  const handleAddNewField = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError("");

    let key = newKeyName.trim();
    if (!key) {
      setFormError("Key name is required");
      return;
    }

    if (newKeyType === "api_node" && !key.endsWith("_api_node")) key += "_api_node";
    if (newKeyType === "js_node" && !key.endsWith("_js_node")) key += "_js_node";
    if (newKeyType === "ts_node" && !key.endsWith("_ts_node")) key += "_ts_node";
    if (newKeyType === "py_node" && !key.endsWith("_py_node")) key += "_py_node";
    if (newKeyType === "math_node" && !key.endsWith("_math_node")) key += "_math_node";
    if (newKeyType === "todo_node" && !key.endsWith("_todo_node")) key += "_todo_node";
    if (newKeyType === "image_node" && !key.endsWith("_image_node")) key += "_image_node";
    if (newKeyType === "transfer_node" && !key.endsWith("_transfer_node")) key += "_transfer_node";
    if (newKeyType === "search_node" && !key.endsWith("_search_node")) key += "_search_node";

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      setFormError(
        "Invalid key: Use alphanumeric characters and underscores only (e.g. system_debug)",
      );
      return;
    }

    const updatedData = parsedData !== undefined && parsedData !== null
      ? JSON.parse(JSON.stringify(parsedData))
      : {};

    let targetParent = updatedData;
    if (newParentPath !== "root") {
      const parts = newParentPath.split(".");
      parts.shift(); // remove 'root'
      for (const p of parts) {
        if (targetParent && typeof targetParent === "object") {
          targetParent = targetParent[p];
        }
      }
    }

    if (!targetParent || typeof targetParent !== "object") {
      setFormError("Target location path is invalid");
      return;
    }

    snapshotHistory();

    // Determine initial values
    let finalValue: any = "";
    if (newKeyType === "string") finalValue = textValue;
    else if (newKeyType === "number") finalValue = Number(numberValue);
    else if (newKeyType === "boolean") finalValue = booleanValue;
    else if (newKeyType === "array") finalValue = [];
    else if (newKeyType === "object") finalValue = {};
    else if (["api_node", "js_node", "ts_node", "py_node", "math_node", "todo_node", "image_node", "transfer_node", "search_node"].includes(newKeyType)) finalValue = "";

    let createdPath = "";
    if (Array.isArray(targetParent)) {
      targetParent.push({ [key]: finalValue });
      const newIndex = targetParent.length - 1;
      createdPath = newParentPath === "root" ? `root.${newIndex}.${key}` : `${newParentPath}.${newIndex}.${key}`;
    } else {
      if (key in targetParent) {
        setFormError(`Key "${key}" already exists within "${newParentPath}"`);
        return;
      }
      targetParent[key] = finalValue;
      createdPath = newParentPath === "root" ? `root.${key}` : `${newParentPath}.${key}`;
    }

    saveUpdatedData(updatedData);

    // Reset Form elements
    setNewKeyName("");
    setTextValue("");
    setNumberValue(0);
    setBooleanValue(true);
    setFormError("");

    setIsMobileDrawerOpen(false);
    triggerToast(`Created attribute "${key}" successfully`, "success");
    setSelectedNodeId(createdPath);
  };

  // CRUD: Update single value inline
  const handleUpdateFieldValue = (fieldPath: string, newValue: any) => {
    const updatedData = parsedData
      ? JSON.parse(JSON.stringify(parsedData))
      : {};
    const parts = fieldPath.split(".");
    parts.shift(); // remove 'root'

    if (parts.length === 0) return;

    let parent = updatedData;
    for (let i = 0; i < parts.length - 1; i++) {
      if (parent && typeof parent === "object") {
        parent = parent[parts[i]];
      }
    }

    const lastKey = parts[parts.length - 1];
    if (parent && typeof parent === "object") {
      snapshotHistory();
      parent[lastKey] = newValue;
      saveUpdatedData(updatedData);
      triggerToast(`Updated "${lastKey}"`, "success");
    }
    setEditingPath(null);
  };

  // CRUD: Rename key name dynamically
  const handleRenameKey = (fieldPath: string, newKey: string) => {
    const targetKey = newKey.trim();
    if (!targetKey) {
      triggerToast("Key name cannot be empty", "error");
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetKey)) {
      triggerToast(
        "Key should contain only letters/numbers/underscores",
        "error",
      );
      return;
    }

    const updatedData = parsedData
      ? JSON.parse(JSON.stringify(parsedData))
      : {};
    const parts = fieldPath.split(".");
    parts.shift(); // remove 'root'

    if (parts.length === 0) return;

    let parent = updatedData;
    for (let i = 0; i < parts.length - 1; i++) {
      if (parent && typeof parent === "object") {
        parent = parent[parts[i]];
      }
    }

    const lastKey = parts[parts.length - 1];
    if (parent && typeof parent === "object") {
      if (targetKey in parent) {
        triggerToast(`Key "${targetKey}" already exists`, "error");
        return;
      }

      snapshotHistory();
      // Clone old value
      const val = parent[lastKey];
      // Keep object ordering by constructing new object with replaced key name
      const keys = Object.keys(parent);
      const newParentObj: Record<string, any> = {};
      for (const k of keys) {
        if (k === lastKey) {
          newParentObj[targetKey] = val;
        } else {
          newParentObj[k] = parent[k];
        }
      }

      // Re-assign back to nested location
      if (parts.length === 1) {
        saveUpdatedData(newParentObj);
      } else {
        // Find grandparents to reassign
        let rootParent = updatedData;
        for (let i = 0; i < parts.length - 2; i++) {
          rootParent = rootParent[parts[i]];
        }
        rootParent[parts[parts.length - 2]] = newParentObj;
        saveUpdatedData(updatedData);
      }
      triggerToast(`Renamed key to "${targetKey}"`, "success");
    }
    setRenamingPath(null);
  };

  // CRUD: Duel field duplicator
  const handleDuplicateField = (fieldPath: string) => {
    const updatedData = parsedData
      ? JSON.parse(JSON.stringify(parsedData))
      : {};
    const parts = fieldPath.split(".");
    parts.shift(); // remove 'root'

    if (parts.length === 0) return;

    let parent = updatedData;
    for (let i = 0; i < parts.length - 1; i++) {
      if (parent && typeof parent === "object") {
        parent = parent[parts[i]];
      }
    }

    const lastKey = parts[parts.length - 1];
    if (parent && typeof parent === "object") {
      if (Array.isArray(parent)) {
        const idx = parseInt(lastKey, 10);
        if (!isNaN(idx)) {
          snapshotHistory();
          const cloned = JSON.parse(JSON.stringify(parent[idx]));
          parent.splice(idx + 1, 0, cloned);
          saveUpdatedData(updatedData);
          triggerToast(`Duplicated element at index ${idx}`, "success");
        }
      } else {
        let copyKey = `${lastKey}_copy`;
        let counter = 1;
        while (copyKey in parent) {
          copyKey = `${lastKey}_copy_${counter}`;
          counter++;
        }

        snapshotHistory();
        // Clone value
        parent[copyKey] = JSON.parse(JSON.stringify(parent[lastKey]));
        saveUpdatedData(updatedData);
        triggerToast(`Duplicated into "${copyKey}"`, "success");
      }
    }
  };

  // CRUD: Move location pathing of key/group
  const handleMoveField = () => {
    if (!movingPath) return;

    const updatedData = parsedData
      ? JSON.parse(JSON.stringify(parsedData))
      : {};

    // Grab value of item being moved
    const itemParts = movingPath.split(".");
    itemParts.shift(); // dismiss root

    if (itemParts.length === 0) return;

    let targetParent = updatedData;
    for (let i = 0; i < itemParts.length - 1; i++) {
      targetParent = targetParent[itemParts[i]];
    }

    const movingKey = itemParts[itemParts.length - 1];
    const valueToMove = JSON.parse(JSON.stringify(targetParent[movingKey]));

    // Remove from original spot
    if (Array.isArray(targetParent)) {
      const idx = parseInt(movingKey, 10);
      if (!isNaN(idx)) targetParent.splice(idx, 1);
    } else {
      delete targetParent[movingKey];
    }

    // Find destination path to inject
    let destParent = updatedData;
    if (moveToPath !== "root") {
      const destParts = moveToPath.split(".");
      destParts.shift();
      for (const dp of destParts) {
        destParent = destParent[dp];
      }
    }

    snapshotHistory();
    if (Array.isArray(destParent)) {
      destParent.push({ [movingKey]: valueToMove });
    } else {
      if (movingKey in destParent) {
        triggerToast(
          `Key conflict: "${movingKey}" already exists in destination`,
          "error",
        );
        setMovingPath(null);
        return;
      }
      destParent[movingKey] = valueToMove;
    }
    saveUpdatedData(updatedData);
    triggerToast(
      `Moved field under "${moveToPath === "root" ? "top level" : moveToPath}"`,
      "success",
    );
    setMovingPath(null);
  };

  // CRUD: Delete key/container securely
  const handleDeleteFieldInstant = (fieldPath: string) => {
    const updatedData = parsedData
      ? JSON.parse(JSON.stringify(parsedData))
      : {};
    const parts = fieldPath.split(".");
    parts.shift(); // remove 'root'

    if (parts.length === 0) return;

    let parent = updatedData;
    for (let i = 0; i < parts.length - 1; i++) {
      if (parent && typeof parent === "object") {
        parent = parent[parts[i]];
      }
    }

    const lastKey = parts[parts.length - 1];
    if (parent && typeof parent === "object") {
      snapshotHistory();
      if (Array.isArray(parent)) {
        const idx = parseInt(lastKey, 10);
        if (!isNaN(idx)) parent.splice(idx, 1);
      } else {
        delete parent[lastKey];
      }
      saveUpdatedData(updatedData);
      triggerToast(`Deleted key "${lastKey}"`, "info");
    }
    setConfirmDeletePath(null);
  };

  // Filter keys and leaf values
  const filteredFields = useMemo(() => {
    return allFields.filter((f) => {
      const queryLower = searchQuery.toLowerCase();
      const matchSearch =
        f.path.toLowerCase().includes(queryLower) ||
        String(f.value).toLowerCase().includes(queryLower);

      const matchType = typeFilter === "all" || f.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [allFields, searchQuery, typeFilter]);

  // Set initial text/numbers/bools when editing triggers
  const startEditing = (field: LeafField) => {
    setEditingPath(field.path);
    if (field.type === "string") {
      setEditingTextValue(field.value);
    } else if (field.type === "number") {
      setEditingNumValue(field.value);
    } else if (field.type === "boolean") {
      setEditingBoolValue(field.value);
    }
  };

  const toggleCollapse = (path: string) => {
    setCollapsedPaths((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Keyboard navigation inside editing inputs
  const handleInputKeyDown = (
    e: React.KeyboardEvent,
    field: LeafField,
    index: number,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val =
        field.type === "string"
          ? editingTextValue
          : field.type === "number"
            ? editingNumValue
            : editingBoolValue;
      handleUpdateFieldValue(field.path, val);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingPath(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Go to next matching field value
      const targetDelta = e.shiftKey ? -1 : 1;
      const cleanFields = filteredFields.filter(
        (f) => f.type !== "array" && f.type !== "object",
      );
      const subIdx = cleanFields.findIndex((f) => f.path === field.path);
      if (subIdx !== -1) {
        let destinationIdx = subIdx + targetDelta;
        if (destinationIdx >= cleanFields.length) destinationIdx = 0;
        if (destinationIdx < 0) destinationIdx = cleanFields.length - 1;

        const destinationField = cleanFields[destinationIdx];
        if (destinationField) {
          startEditing(destinationField);
        }
      }
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row bg-[#f8fafc] dark:bg-[#080c14] md:bg-[#f1f5f9] md:dark:bg-[#090d16] h-full overflow-hidden text-slate-800 dark:text-slate-100 select-none">
      {/* 1. TOAST CONFIRMATION DIALOG / ACTION FLOATER */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="absolute top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl max-w-sm pointer-events-auto"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                toastNotification.type === "success"
                  ? "bg-emerald-500"
                  : toastNotification.type === "error"
                    ? "bg-red-500"
                    : "bg-blue-400"
              }`}
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {toastNotification.message}
            </span>
            <button
              onClick={() => {
                triggerUndo();
                setToastNotification(null);
              }}
              className="ml-auto text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 hover:underline shrink-0"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. DESKTOP / TABLET COLLAPSIBLE SIDEBAR */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="hidden md:flex flex-col h-full bg-white dark:bg-[#0a0e1a]/95 border-r border-slate-200 dark:border-slate-800/80 shrink-0 overflow-y-auto custom-scrollbar"
          >
            <div className="p-5 flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded">
                    <FolderPlus size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Visual Builder
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Notion-style data visualizer
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800/20 hover:bg-slate-200 dark:hover:bg-slate-800/50 rounded transition-colors"
                  title="Collapse side navigation"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Advanced Interactive creation design */}
              <div className="flex flex-col gap-4">
                {/* Parent Insertion dropdown selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Insert Folder / Location</span>
                  </span>
                  <select
                    value={newParentPath}
                    onChange={(e) => setNewParentPath(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800/90 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-705 dark:text-slate-300 cursor-pointer shadow-sm"
                  >
                    {objectPaths.map((op) => (
                      <option
                        key={op.path}
                        value={op.path}
                        className="bg-white dark:bg-[#121824] text-slate-800 dark:text-slate-200"
                      >
                        {op.label === "root" ? "root (Top Level)" : op.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Key attribute input name */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Field Key
                  </span>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. tracking_id"
                    className="w-full text-xs px-3 py-2 bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800/90 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800 dark:text-slate-200 placeholder-slate-450 dark:placeholder-slate-600 shadow-sm"
                  />
                </div>

                {/* Aesthetic Selection cards instead of boring radial selectors */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Value Type
                  </span>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      {
                        type: "string",
                        icon: Type,
                        label: "Text",
                        color: "text-amber-500 dark:text-amber-400 border-amber-500/20",
                      },
                      {
                        type: "number",
                        icon: Hash,
                        label: "Number",
                        color: "text-cyan-500 dark:text-cyan-400 border-cyan-500/20",
                      },
                      {
                        type: "boolean",
                        icon: ToggleLeft,
                        label: "Bool",
                        color: "text-emerald-500 dark:text-emerald-400 border-emerald-500/20",
                      },
                      {
                        type: "array",
                        icon: ListOrdered,
                        label: "List",
                        color: "text-purple-500 dark:text-purple-400 border-purple-500/20",
                      },
                      {
                        type: "object",
                        icon: Braces,
                        label: "Folder",
                        color: "text-indigo-500 dark:text-indigo-400 border-indigo-500/20",
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = newKeyType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setNewKeyType(item.type as any)}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-[10px] gap-1.5 transition-all ${
                            isSelected
                              ? "bg-blue-600/10 text-blue-500 dark:text-blue-400 border-blue-500 shadow-lg shadow-blue-500/5 scale-102"
                              : "border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800/30 text-slate-500 dark:text-slate-400"
                          }`}
                          title={`Select as ${item.label}`}
                        >
                          <Icon
                            size={14}
                            className={
                              isSelected ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                            }
                          />
                          <span className="scale-[0.85] font-semibold leading-none">
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-3 border-t border-slate-200 dark:border-slate-800/50 pt-2 block">
                    Special Nodes
                  </span>
                  <div className="grid grid-cols-3 gap-1 mt-1">
                    {[
                      { type: "api_node", icon: Globe, label: "API Node" },
                      { type: "js_node", icon: FileCode, label: "JS Node" },
                      { type: "ts_node", icon: FileCode, label: "TS Node" },
                      { type: "py_node", icon: FileCode, label: "Py Node" },
                      { type: "math_node", icon: Calculator, label: "Math Node" },
                      { type: "todo_node", icon: CheckSquare, label: "Todo Node" },
                      { type: "image_node", icon: ImageIcon, label: "Image Node" },
                      { type: "transfer_node", icon: ArrowRightLeft, label: "Transfer Node" },
                      { type: "search_node", icon: Search, label: "Search Node" },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = newKeyType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setNewKeyType(item.type as any)}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-md border text-[10px] gap-1.5 transition-all ${
                            isSelected
                              ? "bg-blue-600/10 text-blue-500 dark:text-blue-400 border-blue-500 shadow-lg shadow-blue-500/5 scale-102"
                              : "border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800/30 text-slate-500 dark:text-slate-400"
                          }`}
                          title={`Select as ${item.label}`}
                        >
                          <Icon
                            size={14}
                            className={
                              isSelected ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                            }
                          />
                          <span className="scale-[0.85] font-semibold leading-none">
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contextual description input depending on selected model */}
                <div className="p-3.5 bg-slate-50 dark:bg-[#121824]/60 border border-slate-200 dark:border-slate-800/50 rounded-lg shadow-inner">
                  {newKeyType === "string" && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">
                        Initial Text Contents
                      </span>
                      <textarea
                        value={textValue}
                        onChange={(e) => setTextValue(e.target.value)}
                        placeholder="Enter string content..."
                        rows={3}
                        className="w-full text-xs font-mono px-2.5 py-2 bg-white dark:bg-[#090d16] border border-slate-250 dark:border-slate-800 focus:border-blue-500/80 rounded-lg text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-y min-h-[70px] transition-all shadow-sm"
                      />
                    </div>
                  )}

                  {newKeyType === "number" && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">
                        Initial Value Number
                      </span>
                      <input
                        type="number"
                        value={numberValue}
                        onChange={(e) => setNumberValue(Number(e.target.value))}
                        className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-[#090d16] border border-slate-250 dark:border-slate-800/90 rounded text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                      />
                    </div>
                  )}

                  {newKeyType === "boolean" && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">
                        Toggle Condition
                      </span>
                      <div className="flex items-center p-0.5 bg-slate-200 dark:bg-[#0a0e17] border border-slate-300 dark:border-slate-800/80 rounded-lg w-full max-w-[200px] shadow-inner">
                        <button
                          type="button"
                          onClick={() => setBooleanValue(true)}
                          className={`flex-1 text-center py-1.5 rounded-md text-[11.5px] font-bold transition-all ${
                            booleanValue === true
                              ? "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-750 dark:hover:text-slate-200 border border-transparent"
                          }`}
                        >
                          True
                        </button>
                        <button
                          type="button"
                          onClick={() => setBooleanValue(false)}
                          className={`flex-1 text-center py-1.5 rounded-md text-[11.5px] font-bold transition-all ${
                            booleanValue === false
                              ? "bg-rose-600/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-750 dark:hover:text-slate-200 border border-transparent"
                          }`}
                        >
                          False
                        </button>
                      </div>
                    </div>
                  )}

                  {newKeyType === "array" && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                      Creates an empty checklist nested array index{" "}
                      <code className="font-mono text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded bg-purple-500/5 bg-slate-150 dark:bg-[#090d16] font-bold border border-slate-200 dark:border-slate-800">
                        []
                      </code>
                      . You can group key layers.
                    </p>
                  )}

                  {newKeyType === "object" && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                      Creates an empty nested object directory{" "}
                      <code className="font-mono text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded bg-indigo-500/5 bg-slate-150 dark:bg-[#090d16] font-bold border border-slate-200 dark:border-slate-800">
                        {"{}"}
                      </code>{" "}
                      where children keys can reside.
                    </p>
                  )}

                  {["api_node", "js_node", "ts_node", "py_node", "math_node", "todo_node", "image_node", "transfer_node", "search_node"].includes(newKeyType) && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                      Creates a <strong className="text-blue-500 dark:text-blue-400">{newKeyType.replace("_", " ").toUpperCase()}</strong>. It will be injected into the data structure as an empty <code className="font-mono text-slate-700 dark:text-slate-300">""</code> string with the required suffix for the canvas engine to recognize it automatically. You can edit the node content fully through the interactive canvas.
                    </p>
                  )}
                </div>

                {formError && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-950/20 border border-red-500/20 text-red-400 text-xs leading-normal">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  onClick={() => handleAddNewField()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-slate-100 font-semibold rounded-md text-xs transition-colors shadow-lg"
                >
                  <Plus size={14} />
                  <span>Add Key-Value Field</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MOBILE MODAL / BOTTOM SHEET */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/60 backdrop-blur-xs flex flex-col justify-end">
            <div
              className="absolute inset-0"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-h-[85vh] bg-[#0c101b] border-t border-slate-800 rounded-t-2xl p-5 flex flex-col gap-4 overflow-y-auto pointer-events-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-sm font-bold text-slate-200">
                  Create Field
                </span>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 px-2.5 text-xs text-slate-400 rounded-lg hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              {/* Form implementation for Mobile devices */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Insert Location
                  </span>
                  <select
                    value={newParentPath}
                    onChange={(e) => setNewParentPath(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[#121824] border border-slate-800 rounded-md text-slate-300 font-mono"
                  >
                    {objectPaths.map((op) => (
                      <option key={op.path} value={op.path}>
                        {op.label === "root" ? "root (Top Level)" : op.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Key Attribute Name
                  </span>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. system_debug"
                    className="w-full text-xs px-3 py-2 bg-[#121824] border border-slate-800 rounded-md text-slate-200 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Value Type
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { type: "string", icon: Type, label: "Text" },
                      { type: "number", icon: Hash, label: "Num" },
                      { type: "boolean", icon: ToggleLeft, label: "Bool" },
                      { type: "array", icon: ListOrdered, label: "List" },
                      { type: "object", icon: Braces, label: "Folder" },
                    ].map((item) => (
                      <button
                        key={item.type}
                        onClick={() => setNewKeyType(item.type as any)}
                        className={`flex flex-col items-center justify-center p-2 rounded-md border text-[10px] gap-1 ${
                          newKeyType === item.type
                            ? "bg-blue-600/20 text-blue-400 border-blue-500"
                            : "bg-[#121824] border-slate-800 text-slate-400"
                        }`}
                      >
                        <item.icon size={13} />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2 border-t border-slate-800 pt-2 block">
                    Special Nodes
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[
                      { type: "api_node", icon: Globe, label: "API" },
                      { type: "js_node", icon: FileCode, label: "JS" },
                      { type: "ts_node", icon: FileCode, label: "TS" },
                      { type: "py_node", icon: FileCode, label: "Py" },
                      { type: "math_node", icon: Calculator, label: "Math" },
                      { type: "todo_node", icon: CheckSquare, label: "Todo" },
                      { type: "image_node", icon: ImageIcon, label: "Image" },
                      { type: "transfer_node", icon: ArrowRightLeft, label: "Transfer" },
                      { type: "search_node", icon: Search, label: "Search" },
                    ].map((item) => (
                      <button
                        key={item.type}
                        onClick={() => setNewKeyType(item.type as any)}
                        className={`flex flex-col items-center justify-center p-2 rounded-md border text-[10px] gap-1 ${
                          newKeyType === item.type
                            ? "bg-blue-600/20 text-blue-400 border-blue-500"
                            : "bg-[#121824] border-slate-800 text-slate-400"
                        }`}
                      >
                        <item.icon size={13} />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#121824] border border-slate-800 rounded">
                  {newKeyType === "string" && (
                    <input
                      type="text"
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      placeholder="String value"
                      className="w-full text-xs px-2.5 py-1.5 bg-[#090d16] border border-slate-800 rounded text-slate-200"
                    />
                  )}
                  {newKeyType === "number" && (
                    <input
                      type="number"
                      value={numberValue}
                      onChange={(e) => setNumberValue(Number(e.target.value))}
                      className="w-full text-xs px-2.5 py-1.5 bg-[#090d16] border border-slate-800 rounded text-slate-200"
                    />
                  )}
                  {newKeyType === "boolean" && (
                    <div className="flex items-center p-0.5 bg-[#0a0e17] border border-slate-800 rounded-lg w-full max-w-[150px]">
                      <button
                        type="button"
                        onClick={() => setBooleanValue(true)}
                        className={`flex-1 text-center py-1 rounded-md text-[11px] font-bold transition-all ${
                          booleanValue === true
                            ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        True
                      </button>
                      <button
                        type="button"
                        onClick={() => setBooleanValue(false)}
                        className={`flex-1 text-center py-1 rounded-md text-[11px] font-bold transition-all ${
                          booleanValue === false
                            ? "bg-rose-600/10 text-rose-400 border border-rose-500/20"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        False
                      </button>
                    </div>
                  )}
                  {(newKeyType === "array" || newKeyType === "object") && (
                    <span className="text-[10px] text-slate-400">
                      Installs nested checklist array/objects container
                      instantly.
                    </span>
                  )}
                  {["api_node", "js_node", "ts_node", "py_node", "math_node", "todo_node", "image_node", "transfer_node", "search_node"].includes(newKeyType) && (
                    <span className="text-[10px] text-slate-400">
                      Installs a {newKeyType.replace("_", " ").toUpperCase()} ready to be configured via visual canvas.
                    </span>
                  )}
                </div>

                {formError && (
                  <span className="text-xs text-red-400">{formError}</span>
                )}

                <button
                  onClick={() => handleAddNewField()}
                  className="w-full py-2 bg-blue-600 rounded-lg text-xs font-semibold text-white mt-1"
                >
                  Create Field
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. MAIN WORKSPACE / EXPLORER CANVAS */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8fafc] dark:bg-[#090d16]">
        {/* UPPER MAIN HEADER PANEL - Notion layout */}
        <div className="flex items-center justify-between p-2 sm:p-3 md:p-4 border-b border-slate-255 dark:border-slate-800/65 bg-white dark:bg-[#0b101c]/90 bg-opacity-95 dark:bg-opacity-90">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="hidden md:flex p-1.5 text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 bg-slate-100 dark:bg-[#121824] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-md transition-colors mr-1"
                title="Open Visual Builder"
              >
                <Menu size={14} />
              </button>
            )}
            <div>
              <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 tracking-wider flex items-center gap-1.5 uppercase">
                <span>GUI Editor</span>
                <span className="hidden md:inline-block px-1.5 py-0.5 rounded-sm bg-blue-500/10 border border-blue-500/30 text-[9px] text-blue-550 dark:text-blue-400 tracking-widest font-mono">
                  WORKSPACE
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* View Mode: Tree vs Flat list */}
            <div className="flex items-center bg-slate-200/60 dark:bg-[#121824] border border-slate-300 dark:border-slate-800 rounded-md p-0.5">
              <button
                onClick={() => setViewMode("tree")}
                className={`px-2 sm:px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all ${
                  viewMode === "tree"
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent"
                }`}
                title="Tree View with Expand/Collapse hierarchies"
              >
                Tree<span className="hidden sm:inline"> Mode</span>
              </button>
              <button
                onClick={() => setViewMode("flat")}
                className={`px-2 sm:px-2.5 py-1 text-[10px] font-bold rounded-sm transition-all ${
                  viewMode === "flat"
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent"
                }`}
                title="Flat Table configuration"
              >
                Flat<span className="hidden sm:inline"> List</span>
              </button>
            </div>

            {/* Quick Session Undo / Redo */}
            <div className="flex items-center bg-slate-200/60 dark:bg-[#121824] border border-slate-300 dark:border-slate-800 rounded-md">
              <button
                onClick={triggerUndo}
                className="p-1 px-1.5 sm:px-2 text-slate-550 hover:text-slate-800 hover:bg-slate-300 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-300 dark:border-slate-800"
                title="Undo (Ctrl+Z)"
              >
                <UndoIcon size={13} />
              </button>
              <button
                onClick={triggerRedo}
                className="p-1 px-1.5 sm:px-2 text-slate-550 hover:text-slate-800 hover:bg-slate-300 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <RedoIcon size={13} />
              </button>
            </div>

            {/* Mobile / Tablet "+ Add Field" sheet trigger button */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="md:hidden flex items-center justify-center p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              title="Add Field"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* COMMAND PALETTE STYLE SEARCH BAR */}
        <div className="p-2 sm:p-4 bg-slate-50 dark:bg-[#0a0e1a]/40 border-b border-slate-200 dark:border-slate-800/40 flex flex-col sm:flex-row gap-2 sm:gap-2.5 shadow-sm">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-550 dark:text-slate-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keys, values or full path structures..."
              className="w-full text-xs pl-9 pr-3 py-1.5 sm:py-2 bg-white dark:bg-[#121824] border border-slate-250 dark:border-slate-800/90 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-auto text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-[#121824] border border-slate-250 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer shadow-sm"
            >
              <option value="all">All Data types</option>
              <option value="string">String (Text)</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="array">Array (List)</option>
              <option value="object">Object (Group)</option>
            </select>
          </div>
        </div>

        {/* DATA CONTAINER FIELD LISTINGS */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          {filteredFields.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl max-w-md mx-auto mt-12 gap-3 p-6 bg-slate-50/50 dark:bg-[#0a0e1a]/20">
              <Tag size={28} className="text-slate-400 dark:text-slate-600 animate-pulse" />
              <div>
                <h4 className="text-slate-700 dark:text-slate-300 font-bold text-xs">
                  No entries match filters
                </h4>
                <p className="text-[10px] text-slate-500 mt-1">
                  Try resetting search keywords or type parameters.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col gap-2 max-w-4xl mx-auto pb-10"
              ref={menuContainerRef}
            >
              {/* Dynamic Header */}
              <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">
                <span>
                  {viewMode === "tree"
                    ? "Tree Structure"
                    : "Field Directory Path"}
                </span>
                <span>Actions</span>
              </div>

              {filteredFields.map((field, idx) => {
                const isVisible = isPathVisible(field.path);
                if (!isVisible) return null;

                const isEditing = editingPath === field.path;
                const isRenaming = renamingPath === field.path;
                const isMoving = movingPath === field.path;
                const isContainer =
                  field.type === "array" || field.type === "object";
                const isCollapsed = collapsedPaths[field.path];
                const depth =
                  viewMode === "tree" ? getFieldDepth(field.path) : 0;

                const parentPathParts = field.parentPath.split(".");
                if (parentPathParts[0] === "root") parentPathParts.shift();
                let parentObj = parsedData;
                for (const p of parentPathParts) {
                  if (parentObj) parentObj = parentObj[p];
                }
                const isArrayChild = Array.isArray(parentObj);
                const arrayIndex = isArrayChild ? parseInt(field.keyName, 10) : -1;

                return (
                  <div
                    key={field.path}
                    style={{ marginLeft: `${depth * (isMobile ? 6 : 14)}px` }}
                    className={`relative group flex flex-col p-2 sm:p-3.5 bg-[#fafbfc] dark:bg-[#0d1220]/75 hover:bg-slate-100/50 dark:hover:bg-[#111728]/80 border ${
                      isEditing
                        ? "border-blue-500/70 shadow-lg bg-blue-50/15 dark:bg-[#111624]/60"
                        : "border-slate-205 dark:border-slate-800/75"
                    } rounded-lg transition-all text-slate-800 dark:text-slate-100 duration-150`}
                  >
                    {/* Visual tree indentation guide rails */}
                    {viewMode === "tree" && depth > 0 && (
                      <div
                        className="absolute top-0 bottom-0 border-l border-dashed border-slate-300 dark:border-slate-800/60"
                        style={{ left: "-10px" }}
                      />
                    )}

                    {/* Left & Right Container Section */}
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Fields Details, Paths & Types */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Folder collapse chevron */}
                          {isContainer && viewMode === "tree" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCollapse(field.path);
                              }}
                              className="p-0.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/60 rounded flex items-center justify-center"
                            >
                              {isCollapsed ? (
                                <ChevronRight size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </button>
                          )}

                          {isContainer && (
                            <Folder
                              size={12}
                              className="text-blue-500 dark:text-blue-450 shrink-0 mt-0.5"
                            />
                          )}

                          {/* Interactive Renaming Form inline */}
                          {isRenaming && !isArrayChild ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={newKeyRenameValue}
                                onChange={(e) =>
                                  setNewKeyRenameValue(e.target.value)
                                }
                                className="px-2 py-0.5 text-xs bg-white dark:bg-[#161d2d] border border-blue-500 rounded text-slate-800 dark:text-slate-100 font-mono tracking-wide focus:outline-none"
                                placeholder={field.keyName}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleRenameKey(
                                      field.path,
                                      newKeyRenameValue,
                                      );
                                  if (e.key === "Escape") setRenamingPath(null);
                                }}
                              />
                              <button
                                onClick={() =>
                                  handleRenameKey(field.path, newKeyRenameValue)
                                }
                                className="p-1 bg-green-500/10 text-green-600 dark:text-green-405 hover:bg-green-500/20 rounded"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => setRenamingPath(null)}
                                className="p-1 bg-red-500/10 text-red-600 dark:text-red-405 hover:bg-red-500/20 rounded"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={() => {
                                if (isArrayChild) return;
                                setRenamingPath(field.path);
                                setNewKeyRenameValue(field.keyName);
                              }}
                              className={`font-mono text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 ${!isArrayChild ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline' : ''}`}
                              title={isArrayChild ? "Array elements cannot be renamed" : "Click to rename field"}
                            >
                              {isArrayChild ? `#${field.keyName}` : (viewMode === "tree" ? field.keyName : field.path)}
                              {!isArrayChild && (
                                <Edit3
                                  size={10}
                                  className="opacity-0 group-hover:opacity-60 text-slate-400 dark:text-slate-500 transition-opacity"
                                />
                              )}
                            </span>
                          )}

                          {/* Field type badges */}
                          <span
                            className={`text-[8px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${
                              field.type === "string"
                                ? "text-amber-700 dark:text-amber-400 bg-amber-500/5 border-amber-500/20"
                                : field.type === "number"
                                  ? "text-cyan-750 dark:text-cyan-400 bg-cyan-500/5 border-cyan-500/20"
                                  : field.type === "boolean"
                                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/20"
                                    : field.type === "array"
                                      ? "text-purple-700 dark:text-purple-400 bg-purple-500/5 border-purple-500/20"
                                      : "text-indigo-700 dark:text-indigo-400 bg-indigo-500/5 border-indigo-500/20"
                            }`}
                          >
                            {field.type}
                          </span>
                        </div>

                        {/* Middle value - direct inline edit support */}
                        <div className="mt-2 text-xs">
                          {isEditing ? (
                            field.type === "string" ? (
                              <div
                                className="flex flex-col gap-3 w-full mt-1.5 bg-slate-50 dark:bg-[#080d19]/60 p-3.5 border border-slate-200 dark:border-slate-800/80 rounded-lg select-text"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                    Edit String Value
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                                    {field.value ? `${String(field.value).length} characters` : "Empty string"}
                                  </span>
                                </div>

                                <textarea
                                  value={editingTextValue}
                                  onChange={(e) => setEditingTextValue(e.target.value)}
                                  className="px-3 py-2 text-xs font-mono bg-white dark:bg-[#111726] border border-slate-250 dark:border-slate-800/80 rounded-lg text-slate-800 dark:text-slate-100 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[96px]"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      handleUpdateFieldValue(field.path, editingTextValue);
                                    }
                                    if (e.key === "Escape") setEditingPath(null);
                                  }}
                                  placeholder="Enter string value..."
                                />

                                <div className="flex items-center justify-between gap-4 flex-wrap border-t border-slate-200 dark:border-slate-800/60 pt-3 mt-1">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateFieldValue(field.path, editingTextValue)}
                                      className="py-1.5 px-3.5 text-xs font-bold text-[#060a12] dark:text-[#060a12] bg-emerald-400 hover:bg-emerald-350 active:scale-[0.98] rounded-md transition-all shadow-md"
                                    >
                                      Save Content
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPath(null)}
                                      className="py-1.5 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white rounded-md transition-colors border border-slate-300 dark:border-slate-700/65"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans">
                                    Press <kbd className="bg-slate-150 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono text-[9px]">Enter</kbd> to save, <kbd className="bg-slate-150 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono text-[9px]">Shift+Enter</kbd> for newline
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 max-w-full">
                                {field.type === "number" && (
                                  <input
                                    type="number"
                                    value={editingNumValue}
                                    onChange={(e) =>
                                      setEditingNumValue(Number(e.target.value))
                                    }
                                    className="px-2.5 py-1 text-xs bg-white dark:bg-[#161d2d] border border-slate-250 dark:border-blue-500/80 rounded text-slate-800 dark:text-slate-100 max-w-[150px] focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                                    autoFocus
                                    onKeyDown={(e) =>
                                      handleInputKeyDown(e, field, idx)
                                    }
                                  />
                                )}
                                {field.type === "boolean" && (
                                  <div className="flex items-center p-0.5 bg-slate-105 dark:bg-[#0a0e17] border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-[140px] select-none shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() => setEditingBoolValue(true)}
                                      className={`flex-1 text-center py-1 rounded-md text-[10px] font-bold transition-all ${
                                        editingBoolValue === true
                                          ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                      }`}
                                    >
                                      True
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingBoolValue(false)}
                                      className={`flex-1 text-center py-1 rounded-md text-[10px] font-bold transition-all ${
                                        editingBoolValue === false
                                          ? "bg-rose-600/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                      }`}
                                    >
                                      False
                                    </button>
                                  </div>
                                )}
 
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      const val =
                                        field.type === "number"
                                          ? editingNumValue
                                          : editingBoolValue;
                                      handleUpdateFieldValue(field.path, val);
                                    }}
                                    className="p-1 px-2 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 rounded"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingPath(null)}
                                    className="p-1 px-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-705 rounded shadow-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
 
                                <span className="text-[9px] text-slate-500 italic hidden lg:inline mx-1">
                                  [Enter to Save, Tab to cycle]
                                </span>
                              </div>
                            )
                          ) : (
                            <div
                              onClick={() => {
                                if (isContainer) {
                                  toggleCollapse(field.path);
                                } else {
                                  startEditing(field);
                                }
                              }}
                              className={`font-mono text-[11px] leading-relaxed transition-all ${
                                isContainer
                                  ? "text-slate-500 dark:text-slate-400 italic cursor-pointer hover:bg-slate-205/60 dark:hover:bg-slate-800/30 px-1.5 py-0.5 rounded flex items-center gap-1.5 select-none"
                                  : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer hover:bg-slate-205/65 dark:hover:bg-slate-800/40 px-1.5 py-0.5 rounded"
                              }`}
                              title={
                                isContainer
                                  ? "Click to expand/collapse container items"
                                  : "Double click or click to edit value instantly"
                              }
                            >
                              {isContainer ? (
                                <div className="flex items-center gap-1.5">
                                  {field.type === "array" ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-slate-500 dark:text-slate-400 italic font-medium">
                                        [] List Container ({Array.isArray(field.value) ? field.value.length : 0} elements)
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span>{"{}"} Group folder</span>
                                    </div>
                                  )}
                                </div>
                              ) : field.type === "boolean" ? (
                                <span
                                  className={`font-bold uppercase tracking-wider rounded-sm px-1.5 py-0.5 text-[9px] ${
                                    field.value
                                      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                                      : "text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20"
                                  }`}
                                >
                                  {String(field.value)}
                                </span>
                              ) : (
                                <span className="break-all font-mono text-slate-800 dark:text-slate-200">
                                  {field.value === ""
                                    ? `""`
                                    : String(field.value)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Premium dropdown/options button "⋯" */}
                      <div className="relative shrink-0 flex items-center self-center">
                        {/* Interactive Move Relocate drop panel inline */}
                        {isMoving && (
                          <div className="absolute right-0 top-6 z-35 p-3 bg-white dark:bg-[#111624] border border-slate-205 dark:border-slate-800 rounded-lg shadow-2xl flex flex-col gap-2 min-w-[200px]">
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Move field destination
                            </span>
                            <select
                              value={moveToPath}
                              onChange={(e) => setMoveToPath(e.target.value)}
                              className="w-full text-xs px-2 py-1 bg-white dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 rounded text-slate-700 dark:text-slate-300"
                            >
                              {objectPaths.map((op) => (
                                <option key={op.path} value={op.path}>
                                  {op.label === "root"
                                    ? "root (Top level)"
                                    : op.label}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1 mt-1 justify-end">
                              <button
                                onClick={handleMoveField}
                                className="px-2 py-1 bg-blue-600 text-[10px] font-bold text-white rounded shadow-sm"
                              >
                                Move
                              </button>
                              <button
                                onClick={() => setMovingPath(null)}
                                className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 rounded hover:bg-slate-300 dark:hover:bg-slate-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() =>
                            setActiveMenuPath(
                              activeMenuPath === field.path ? null : field.path,
                            )
                          }
                          className="p-1 px-1.5 text-slate-400 hover:text-slate-750 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded transition-colors"
                          title="Show key commands"
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {/* Floating visual commands popover */}
                        <AnimatePresence>
                          {activeMenuPath === field.path && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute right-0 top-7 z-40 w-44 rounded-lg bg-white dark:bg-[#0f1524] border border-slate-200 dark:border-slate-800 shadow-2xl p-1 pointer-events-auto"
                            >
                              {!isContainer && (
                                <button
                                  onClick={() => {
                                    startEditing(field);
                                    setActiveMenuPath(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                >
                                  <Edit3
                                    size={12}
                                    className="text-yellow-400"
                                  />
                                  <span>Edit Value</span>
                                </button>
                              )}

                              {field.type === "boolean" && (
                                <button
                                  onClick={() => {
                                    handleUpdateFieldValue(
                                      field.path,
                                      !field.value,
                                    );
                                    setActiveMenuPath(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                >
                                  <ToggleLeft
                                    size={12}
                                    className="text-emerald-500"
                                  />
                                  <span>Toggle Condition</span>
                                </button>
                              )}

                              {!isArrayChild && (
                                <button
                                  onClick={() => {
                                    setRenamingPath(field.path);
                                    setNewKeyRenameValue(field.keyName);
                                    setActiveMenuPath(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                >
                                  <Settings size={12} className="text-blue-550 dark:text-blue-400" />
                                  <span>Rename Key</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  handleDuplicateField(field.path);
                                  setActiveMenuPath(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              >
                                <Copy size={12} className="text-purple-600 dark:text-purple-400" />
                                <span>Duplicate</span>
                              </button>

                              {!isArrayChild && (
                                <button
                                  onClick={() => {
                                    setMovingPath(field.path);
                                    setMoveToPath(field.parentPath || "root");
                                    setActiveMenuPath(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                >
                                  <Move size={12} className="text-cyan-600 dark:text-cyan-400" />
                                  <span>Relocate/Move To</span>
                                </button>
                              )}

                              {isArrayChild && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleMoveArrayElement(field.parentPath, arrayIndex, "up");
                                      setActiveMenuPath(null);
                                    }}
                                    disabled={arrayIndex === 0}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                  >
                                    <ChevronDown size={12} className="rotate-180 text-slate-500" />
                                    <span>Move Up</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleMoveArrayElement(field.parentPath, arrayIndex, "down");
                                      setActiveMenuPath(null);
                                    }}
                                    disabled={!Array.isArray(parentObj) || arrayIndex === parentObj.length - 1}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                  >
                                    <ChevronDown size={12} className="text-slate-500" />
                                    <span>Move Down</span>
                                  </button>
                                </>
                              )}

                              <hr className="my-1 border-slate-150 dark:border-slate-800" />

                              <button
                                onClick={() => {
                                  setConfirmDeletePath(field.path);
                                  setActiveMenuPath(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-red-500 dk:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              >
                                <Trash2 size={12} className="text-red-500 dark:text-red-400" />
                                <span>Delete Field</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Inline Add Property block for objects */}
                    {field.type === "object" && !isCollapsed && (
                      <div 
                        className="mt-3.5 p-3.5 bg-slate-100/50 dark:bg-[#0a0e17] border border-slate-205 dark:border-slate-800/80 rounded-lg flex flex-col gap-2.5 w-full" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="Key name"
                            value={newArrayElementInputs[field.path]?.key || ""}
                            onChange={(e) => {
                              setNewArrayElementInputs((prev) => ({
                                ...prev,
                                [field.path]: {
                                  value: prev[field.path]?.value || "",
                                  type: prev[field.path]?.type || "string",
                                  key: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                                },
                              }));
                            }}
                            className="w-24 shrink-0 text-[11px] px-2.5 py-1 bg-white dark:bg-[#121824] border border-slate-300 dark:border-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 font-mono placeholder-slate-400 dark:placeholder-slate-650"
                          />

                          <div className="flex items-center bg-slate-200 dark:bg-[#121824] border border-slate-300 dark:border-slate-800 rounded p-0.5 shrink-0 shadow-inner overflow-x-auto no-scrollbar max-w-full">
                            {(["string", "number", "boolean", "null", "object", "array"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  setNewArrayElementInputs((prev) => ({
                                    ...prev,
                                    [field.path]: {
                                      value: prev[field.path]?.value || "",
                                      type: t as any,
                                      key: prev[field.path]?.key || "",
                                    },
                                  }));
                                }}
                                className={`px-2 py-0.5 text-[8.5px] font-extrabold uppercase rounded-sm transition-all whitespace-nowrap ${
                                  (newArrayElementInputs[field.path]?.type || "string") === t
                                    ? "bg-blue-600 dark:bg-blue-500/20 text-white dark:text-blue-400 border border-blue-500/20 shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                {t === "string" ? "str" : t === "number" ? "num" : t === "boolean" ? "bool" : t}
                              </button>
                            ))}
                          </div>

                          {(newArrayElementInputs[field.path]?.type === "object" || newArrayElementInputs[field.path]?.type === "array" || newArrayElementInputs[field.path]?.type === "null") ? (
                            <div className="flex-1 text-[11px] px-2.5 py-1 text-slate-500 italic">
                                {newArrayElementInputs[field.path]?.type === "object" ? "Adds empty object {}" : newArrayElementInputs[field.path]?.type === "array" ? "Adds empty array []" : "Adds null"}
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder={
                                (newArrayElementInputs[field.path]?.type || "string") === "boolean"
                                  ? "Enter true or false"
                                  : (newArrayElementInputs[field.path]?.type || "string") === "number"
                                    ? "Enter number value"
                                    : "Enter field value"
                              }
                              value={newArrayElementInputs[field.path]?.value || ""}
                              onChange={(e) => {
                                setNewArrayElementInputs((prev) => ({
                                  ...prev,
                                  [field.path]: {
                                    value: e.target.value,
                                    type: prev[field.path]?.type || "string",
                                    key: prev[field.path]?.key || "",
                                  },
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddObjectProperty(field.path);
                              }}
                              className="flex-1 min-w-[100px] text-[11px] px-2.5 py-1 bg-white dark:bg-[#121824] border border-slate-300 dark:border-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 font-mono placeholder-slate-400 dark:placeholder-slate-650"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleAddObjectProperty(field.path)}
                            className="px-3.5 py-1.5 text-[10.5px] font-bold rounded bg-blue-600 hover:bg-blue-500 text-slate-100 flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <Plus size={12} />
                            <span>Add Property</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <AnimatePresence>
                      {confirmDeletePath === field.path && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 p-3 bg-red-100/40 dark:bg-red-950/20 border border-red-300 dark:border-red-500/20 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <span className="text-[11px] text-red-700 dark:text-red-300 font-semibold">
                            Delete field "{field.keyName}"? This can be undone
                            from history tab.
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() =>
                                handleDeleteFieldInstant(field.path)
                              }
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold shadow-sm"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeletePath(null)}
                              className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold hover:bg-slate-300 dark:hover:bg-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Dedicated List elements block for visual array editing */}
                    {field.type === "array" && !isCollapsed && (
                      <div 
                        className="mt-3.5 p-3.5 bg-slate-100/50 dark:bg-[#0a0e17] border border-slate-205 dark:border-slate-800/80 rounded-lg flex flex-col gap-2.5 w-full" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center bg-slate-200 dark:bg-[#121824] border border-slate-300 dark:border-slate-800 rounded p-0.5 shrink-0 shadow-inner overflow-x-auto no-scrollbar max-w-full">
                            {(["string", "number", "boolean", "null", "object", "array"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  setNewArrayElementInputs((prev) => ({
                                    ...prev,
                                    [field.path]: {
                                      value: prev[field.path]?.value || "",
                                      type: t as any,
                                    },
                                  }));
                                }}
                                className={`px-2 py-0.5 text-[8.5px] font-extrabold uppercase rounded-sm transition-all ${
                                  (newArrayElementInputs[field.path]?.type || "string") === t
                                    ? "bg-purple-605 dark:bg-purple-600/10 text-white dark:text-purple-400 border border-purple-500/20 shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                {t === "string" ? "str" : t === "number" ? "num" : t === "boolean" ? "bool" : t}
                              </button>
                            ))}
                          </div>

                          {(newArrayElementInputs[field.path]?.type === "object" || newArrayElementInputs[field.path]?.type === "array" || newArrayElementInputs[field.path]?.type === "null") ? (
                            <div className="flex-1 text-[11px] px-2.5 py-1 text-slate-500 italic">
                                {newArrayElementInputs[field.path]?.type === "object" ? "Adds empty object {}" : newArrayElementInputs[field.path]?.type === "array" ? "Adds empty array []" : "Adds null"}
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder={
                                (newArrayElementInputs[field.path]?.type || "string") === "boolean"
                                  ? "Enter true or false"
                                  : (newArrayElementInputs[field.path]?.type || "string") === "number"
                                    ? "Enter number value"
                                    : "Enter item value"
                              }
                              value={newArrayElementInputs[field.path]?.value || ""}
                              onChange={(e) => {
                                setNewArrayElementInputs((prev) => ({
                                  ...prev,
                                  [field.path]: {
                                    value: e.target.value,
                                    type: prev[field.path]?.type || "string",
                                  },
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddArrayElement(field.path);
                              }}
                              className="flex-1 min-w-[100px] text-[11px] px-2.5 py-1 bg-white dark:bg-[#121824] border border-slate-300 dark:border-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800 dark:text-slate-100 font-mono placeholder-slate-400 dark:placeholder-slate-650"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleAddArrayElement(field.path)}
                            className="px-3.5 py-1.5 text-[10.5px] font-bold rounded bg-purple-600 hover:bg-purple-500 text-slate-100 flex items-center justify-center gap-1 transition-colors"
                          >
                            <Plus size={12} />
                            <span>Add Element</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
