import React from "react";
import { useStore } from "../store/useStore";
import {
  Type,
  Hash,
  ToggleLeft,
  Braces,
  Brackets,
  CircleSlash,
  Globe,
  FileCode,
  Code,
  Terminal,
  Sigma,
  ListTodo,
  Image as ImageIcon,
  Share2,
} from "lucide-react";

export interface SimpleNodeType {
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  label: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  border: string;
}

export interface AdvancedNodeType {
  suffix: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  type: string;
  value: string;
}

export const SIMPLE_CHILD_TYPES: SimpleNodeType[] = [
  {
    type: "string",
    label: "String",
    hint: '""',
    icon: Type,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
  },
  {
    type: "number",
    label: "Number",
    hint: "0",
    icon: Hash,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    type: "boolean",
    label: "Boolean",
    hint: "false",
    icon: ToggleLeft,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    type: "object",
    label: "Object",
    hint: "{}",
    icon: Braces,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    type: "array",
    label: "Array",
    hint: "[]",
    icon: Brackets,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
  },
  {
    type: "null",
    label: "Null",
    hint: "null",
    icon: CircleSlash,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
  },
];

export const ADVANCED_NODE_TYPES: AdvancedNodeType[] = [
  {
    suffix: "api_node",
    label: "API Node",
    desc: "Live REST endpoint",
    icon: Globe,
    iconClass: "text-amber-500",
    type: "string",
    value: "https://jsonplaceholder.typicode.com/todos/1",
  },
  {
    suffix: "js_node",
    label: "JS Runner",
    desc: "Interactive JS code",
    icon: FileCode,
    iconClass: "text-yellow-500",
    type: "string",
    value: "// JS execution starts here!\n",
  },
  {
    suffix: "ts_node",
    label: "TS Runner",
    desc: "TypeScript execution",
    icon: Code,
    iconClass: "text-blue-500",
    type: "string",
    value: "const msg: string = 'TS execution starts here!';\n",
  },
  {
    suffix: "py_node",
    label: "Python",
    desc: "Pyodide Python runner",
    icon: Terminal,
    iconClass: "text-emerald-500",
    type: "string",
    value: "print('Python execution starts here!')",
  },
  {
    suffix: "math_node",
    label: "Math Graph",
    desc: "Mafs function grapher",
    icon: Sigma,
    iconClass: "text-rose-500",
    type: "string",
    value: "f(x) = sin(x)",
  },
  {
    suffix: "todo_node",
    label: "Todo Board",
    desc: "Checklist & tasks",
    icon: ListTodo,
    iconClass: "text-purple-500",
    type: "string",
    value: JSON.stringify({ title: "Tasks", tasks: [] }),
  },
  {
    suffix: "image_node",
    label: "Image Node",
    desc: "Media visualizer",
    icon: ImageIcon,
    iconClass: "text-cyan-500",
    type: "string",
    value: "",
  },
  {
    suffix: "transfer_node",
    label: "Transfer",
    desc: "Flow / transfer node",
    icon: Share2,
    iconClass: "text-indigo-500",
    type: "string",
    value: "",
  },
];

export const splitNodePath = (path: string): string[] =>
  path
    .split(/(?=\[)|(?=\.)/)
    .filter(Boolean)
    .map((part) => (part.startsWith(".") ? part.substring(1) : part.replace(/[\[\]"]/g, "")));

/** Reads the current value at a node path, including paths inside fetched API responses */
export const getValueAtNodePath = (path: string): any => {
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
export const getParentNodePath = (path: string): string | null => {
  if (path === "root") return null;
  const match = path.match(/^(.+?)(\.[^.[\]]+|\[[^\]]*\])$/);
  return match ? match[1] : null;
};

export const getUniqueKey = (target: Record<string, unknown> | null | undefined, type: string): string => {
  if (!target || typeof target !== "object") return `new_${type}`;
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

/**
 * Applies a node modification (add, edit, or delete) to parsedData / code in the store.
 */
export async function applyJsonNodeChange(
  nodePath: string,
  action: "edit" | "add" | "delete",
  newValueStr: string,
  newKeyStr?: string,
  typeOverride?: string
): Promise<void> {
  try {
    const {
      code,
      setCode,
      codeFormat,
      parsedData,
      apiNodeResponses,
      setApiNodeResponse,
      removeApiNode,
    } = useStore.getState();

    if (nodePath.includes(".__fetched")) {
      const fetchedMarker = ".__fetched";
      const idx = nodePath.indexOf(fetchedMarker);
      const apiNodePath = nodePath.substring(0, idx);
      const relativePath = nodePath.substring(idx + fetchedMarker.length);

      let finalValue: any = newValueStr;
      if (action === "edit" || action === "add") {
        if (typeOverride && typeOverride !== "auto") {
          if (typeOverride === "object") {
            try {
              finalValue = newValueStr ? JSON.parse(newValueStr) : {};
              if (typeof finalValue !== "object" || Array.isArray(finalValue) || finalValue === null) {
                finalValue = {};
              }
            } catch {
              finalValue = {};
            }
          } else if (typeOverride === "array") {
            try {
              finalValue = newValueStr ? JSON.parse(newValueStr) : [];
              if (!Array.isArray(finalValue)) {
                finalValue = [];
              }
            } catch {
              finalValue = [];
            }
          } else if (typeOverride === "null") finalValue = null;
          else if (typeOverride === "boolean") finalValue = newValueStr === "true";
          else if (typeOverride === "number") {
            const num = Number(newValueStr);
            finalValue = isNaN(num) ? 0 : num;
          } else if (typeOverride === "string") finalValue = newValueStr;
        } else {
          try {
            finalValue = JSON.parse(newValueStr || '""');
          } catch {
            finalValue = newValueStr;
          }
        }
      }

      const originalResponse = apiNodeResponses[apiNodePath];
      if (relativePath === "") {
        if (action === "edit") {
          setApiNodeResponse(apiNodePath, finalValue);
        } else if (action === "delete") {
          removeApiNode(apiNodePath);
        } else if (action === "add") {
          let cloned =
            originalResponse !== undefined
              ? JSON.parse(JSON.stringify(originalResponse))
              : {};
          if (Array.isArray(cloned)) {
            cloned.push(finalValue);
          } else if (cloned && typeof cloned === "object") {
            if (newKeyStr) cloned[newKeyStr] = finalValue;
          }
          setApiNodeResponse(apiNodePath, cloned);
        }
        return;
      }

      // Relative path modification inside API response
      const parts = relativePath
        .split(/(?=\[)|(?=\.)/)
        .filter(Boolean)
        .map((p) => (p.startsWith(".") ? p.substring(1) : p.replace(/[\[\]]/g, "")));

      const cloned = JSON.parse(JSON.stringify(originalResponse));
      let current = cloned;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current === undefined || current === null || typeof current !== "object") break;
        current = current[parts[i]];
      }

      if (current === undefined || current === null || typeof current !== "object") {
        console.warn("Invalid path for changes relative to api node", relativePath);
        return;
      }

      const lastKey = parts[parts.length - 1];

      if (action === "edit") {
        if (newKeyStr && newKeyStr !== lastKey && !Array.isArray(current)) {
          delete current[lastKey];
          current[newKeyStr] = finalValue;
        } else {
          current[lastKey] = finalValue;
        }
      } else if (action === "delete") {
        if (Array.isArray(current)) {
          const numIndex = Number(lastKey);
          if (!isNaN(numIndex)) {
            current.splice(numIndex, 1);
          }
        } else if (typeof current === "object" && current !== null) {
          delete current[lastKey];
        }
      } else if (action === "add") {
        const target = current[lastKey];
        if (Array.isArray(target)) {
          target.push(finalValue);
        } else if (typeof target === "object" && target !== null) {
          if (newKeyStr) target[newKeyStr] = finalValue;
        }
      }

      setApiNodeResponse(apiNodePath, cloned);
      return;
    }

    const parsed = parsedData
      ? JSON.parse(JSON.stringify(parsedData))
      : codeFormat === "yaml"
        ? {}
        : JSON.parse(code);

    let finalValue: any = newValueStr;

    if (action === "edit" || action === "add") {
      if (typeOverride && typeOverride !== "auto") {
        if (typeOverride === "object") {
          try {
            finalValue = newValueStr ? JSON.parse(newValueStr) : {};
            if (typeof finalValue !== "object" || Array.isArray(finalValue) || finalValue === null) {
              finalValue = {};
            }
          } catch {
            finalValue = {};
          }
        } else if (typeOverride === "array") {
          try {
            finalValue = newValueStr ? JSON.parse(newValueStr) : [];
            if (!Array.isArray(finalValue)) {
              finalValue = [];
            }
          } catch {
            finalValue = [];
          }
        } else if (typeOverride === "null") finalValue = null;
        else if (typeOverride === "boolean") finalValue = newValueStr === "true";
        else if (typeOverride === "number") {
          const num = Number(newValueStr);
          finalValue = isNaN(num) ? 0 : num;
        } else if (typeOverride === "string") finalValue = newValueStr;
      } else {
        try {
          finalValue = JSON.parse(newValueStr || '""');
        } catch {
          finalValue = newValueStr;
        }
      }
    }

    if (nodePath === "root") {
      if (action === "edit") {
        if (codeFormat === "yaml") {
          try {
            const yaml = (await import("js-yaml")).default;
            setCode(yaml.dump(finalValue));
          } catch (err) {
            console.error("js-yaml import failed", err);
          }
        } else {
          setCode(JSON.stringify(finalValue, null, 2));
        }
      } else if (action === "delete") {
        if (codeFormat === "yaml") {
          setCode("");
        } else {
          setCode("{}");
        }
      } else if (action === "add") {
        if (Array.isArray(parsed)) parsed.push(finalValue);
        else if (typeof parsed === "object" && parsed !== null) {
          if (newKeyStr) parsed[newKeyStr] = finalValue;
        }
        if (codeFormat === "yaml") {
          try {
            const yaml = (await import("js-yaml")).default;
            setCode(yaml.dump(parsed));
          } catch (err) {
            console.error("js-yaml import failed", err);
          }
        } else {
          setCode(JSON.stringify(parsed, null, 2));
        }
      }
      return;
    }

    const parts = nodePath
      .replace(/^root/, "")
      .split(/(?=\[)|(?=\.)/)
      .filter(Boolean)
      .map((p) => (p.startsWith(".") ? p.substring(1) : p.replace(/[\[\]]/g, "")));

    let current = parsed;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current === undefined || current === null || typeof current !== "object") break;
      current = current[parts[i]];
    }

    if (current === undefined || current === null || typeof current !== "object") {
      console.warn("Invalid path for changes, current is not an object", nodePath);
      return;
    }

    const lastKey = parts[parts.length - 1];

    if (action === "edit") {
      if (newKeyStr && newKeyStr !== lastKey && !Array.isArray(current)) {
        delete current[lastKey];
        current[newKeyStr] = finalValue;
      } else {
        current[lastKey] = finalValue;
      }
    } else if (action === "delete") {
      if (Array.isArray(current)) {
        current.splice(Number(lastKey), 1);
      } else {
        delete current[lastKey];
      }
    } else if (action === "add") {
      const target = current[lastKey];
      if (Array.isArray(target)) {
        target.push(finalValue);
      } else if (typeof target === "object" && target !== null) {
        if (newKeyStr) target[newKeyStr] = finalValue;
      }
    }

    if (codeFormat === "yaml") {
      const yaml = (await import("js-yaml")).default;
      setCode(yaml.dump(parsed));
    } else {
      setCode(JSON.stringify(parsed, null, 2));
    }
  } catch (e) {
    console.error("Failed to update JSON/YAML/CSV", e);
    useStore.getState().setNotification({
      message: "Invalid format or edit failure. Check if key is empty for object insertions.",
      type: "error",
    });
  }
}
