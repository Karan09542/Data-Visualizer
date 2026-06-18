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
