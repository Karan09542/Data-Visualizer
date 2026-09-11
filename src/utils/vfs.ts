export function cleanNodeName(rawName: string): string {
  if (!rawName) return rawName;
  if (rawName.endsWith("_ts_node")) return rawName.replace(/_ts_node$/, ".ts");
  if (rawName.endsWith("_js_node")) return rawName.replace(/_js_node$/, ".js");
  if (rawName.endsWith("_py_node")) return rawName.replace(/_py_node$/, ".py");
  if (rawName.endsWith("_api_node"))
    return rawName.replace(/_api_node$/, ".api");
  if (rawName.endsWith("_todo_node"))
    return rawName.replace(/_todo_node$/, ".todo");
  if (rawName.endsWith("_json_node"))
    return rawName.replace(/_json_node$/, ".json");
  if (rawName.endsWith("_json")) return rawName.replace(/_json$/, ".json");
  if (rawName.endsWith("_yaml")) return rawName.replace(/_yaml$/, ".yaml");
  if (rawName.endsWith("_yml")) return rawName.replace(/_yml$/, ".yml");
  if (rawName.endsWith("_csv")) return rawName.replace(/_csv$/, ".csv");
  if (rawName.endsWith("_xml")) return rawName.replace(/_xml$/, ".xml");
  if (rawName.endsWith("_md")) return rawName.replace(/_md$/, ".md");
  if (rawName.endsWith("_txt")) return rawName.replace(/_txt$/, ".txt");
  return rawName;
}

export function buildVfsMap(parsedData: any): Record<string, string> {
  const map: Record<string, string> = {};

  function traverse(obj: any, parentFsPath: string, parentObjPath: string) {
    if (typeof obj !== "object" || obj === null) return;
    for (const [key, val] of Object.entries(obj)) {
      const currentObjPath = parentObjPath ? `${parentObjPath}.${key}` : key;
      if (typeof val === "string") {
        const baseName = cleanNodeName(key);
        const fsPath = parentFsPath
          ? `${parentFsPath}/${baseName}`
          : `/${baseName}`;
        map[fsPath] = currentObjPath;
      } else if (
        typeof val === "object" &&
        val !== null &&
        !Array.isArray(val)
      ) {
        const nextFsPath = parentFsPath ? `${parentFsPath}/${key}` : `/${key}`;
        traverse(val, nextFsPath, currentObjPath);
      }
    }
  }

  traverse(parsedData, "", "root");
  return map;
}

/** The node key suffixes the workspace uses for the file types it knows. */
const KEY_SUFFIX: Record<string, string> = {
  ts: "_ts_node", js: "_js_node", py: "_py_node", api: "_api_node", todo: "_todo_node",
  json: "_json", yaml: "_yaml", yml: "_yml", csv: "_csv", xml: "_xml", md: "_md", txt: "_txt",
};

/**
 * The key a file belongs under in the tree: "om.txt" -> "om_txt". The other direction of
 * cleanNodeName, for files Python created that the workspace has never seen.
 */
export function fileNameToNodeKey(fileName: string): string {
  const name = (fileName || "").trim();
  if (!name || name === "." || name === ".." || name.includes("/")) return "";
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const suffix = KEY_SUFFIX[extension];
  if (suffix) return `${base}${suffix}`;
  // A type the workspace has no node for: the name stands as the key, with dots made safe
  // because a dot separates one node from the next.
  return name.replace(/\./g, "_");
}

export function buildVirtualFS(parsedData: any) {
  const vfs: Record<string, string> = {};

  function traverse(obj: any, parentFsPath: string) {
    if (typeof obj !== "object" || obj === null) return;

    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "string") {
        const baseName = cleanNodeName(key);
        const fsPath = parentFsPath
          ? `${parentFsPath}/${baseName}`
          : `/${baseName}`;
        vfs[fsPath] = val;
      } else if (
        typeof val === "object" &&
        val !== null &&
        !Array.isArray(val)
      ) {
        const nextPath = parentFsPath ? `${parentFsPath}/${key}` : `/${key}`;
        traverse(val, nextPath);
      }
    }
  }

  traverse(parsedData, "");
  return vfs;
}

export function getVirtualPath(objectPath: string, parsedData: any): string {
  const parts = objectPath
    .replace(/^root\.?/, "")
    .split(/\.|(?=\[)/)
    .filter(Boolean);
  let currentPath = "";

  let currentObj = parsedData;
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (part.startsWith("[")) {
      part = part.slice(1, -1);
    }

    const isLast = i === parts.length - 1;
    if (isLast) {
      currentPath += `/${cleanNodeName(part)}`;
    } else {
      currentPath += `/${part}`;
    }
    if (currentObj) currentObj = currentObj[part];
  }
  return currentPath || "/__entry.ts";
}

export function resolveVirtualPath(
  request: string,
  currentPath: string,
): string {
  if (!request.startsWith(".")) return request; // non-relative package or absolute (will handle in python or just leave)

  const currentDir =
    currentPath.substring(0, currentPath.lastIndexOf("/")) || "";
  const parts = currentDir.split("/").filter(Boolean);

  const requestParts = request.split("/");
  for (const part of requestParts) {
    if (part === ".") continue;
    if (part === "..") {
      if (parts.length > 0) parts.pop();
    } else {
      parts.push(part);
    }
  }

  return "/" + parts.join("/");
}
