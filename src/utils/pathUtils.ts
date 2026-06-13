export function getParts(path: string): string[] {
  if (!path) return [];
  return path
    .replace(/^root\.?/, "")
    .split(/\.|(?=\[)/)
    .filter(Boolean)
    .map((p) => (p.startsWith("[") ? p.slice(1, -1) : p));
}

export function getValueAtPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = getParts(path);
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

export function setValueAtPath(obj: any, path: string, value: any): any {
  let newObj = JSON.parse(JSON.stringify(obj || {}));
  const parts = getParts(path);
  if (parts.length === 0) {
    return value;
  }

  if (newObj === null || typeof newObj !== "object" || Array.isArray(newObj)) {
    newObj = {};
  }

  let current = newObj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      current[part] === undefined ||
      current[part] === null ||
      typeof current[part] !== "object" ||
      Array.isArray(current[part])
    ) {
      if (current === null || typeof current !== "object") {
        current = {};
      }
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  if (current === null || typeof current !== "object") {
    current = {};
  }
  current[lastPart] = value;
  return newObj;
}

export function deleteValueAtPath(obj: any, path: string): any {
  const newObj = JSON.parse(JSON.stringify(obj || {}));
  const parts = getParts(path);
  if (parts.length === 0) return {};

  let current = newObj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current || typeof current !== "object") return newObj;
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    delete current[lastPart];
  }
  return newObj;
}

export function renameKeyAtPath(
  obj: any,
  parentPath: string,
  oldKey: string,
  newKey: string
): any {
  const newObj = JSON.parse(JSON.stringify(obj || {}));
  const parts = getParts(parentPath);

  let current = newObj;
  if (parts.length > 0) {
    for (const part of parts) {
      if (!current || typeof current !== "object") return newObj;
      current = current[part];
    }
  }

  if (current && typeof current === "object" && oldKey in current) {
    const value = current[oldKey];
    const keys = Object.keys(current);
    const updated: any = {};
    for (const k of keys) {
      if (k === oldKey) {
        updated[newKey] = value;
      } else {
        updated[k] = current[k];
      }
    }

    for (const k of keys) {
      delete current[k];
    }
    Object.assign(current, updated);
  }
  return newObj;
}

export function duplicateValueAtPath(obj: any, path: string): { newObj: any; newPath: string } {
  const newObj = JSON.parse(JSON.stringify(obj || {}));
  const parts = getParts(path);
  if (parts.length === 0) return { newObj, newPath: path };

  let current = newObj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current || typeof current !== "object") return { newObj, newPath: path };
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  let newKey = `${lastPart}_copy`;
  if (current && typeof current === "object" && lastPart in current) {
    const originalValue = current[lastPart];
    const valueCopy = JSON.parse(JSON.stringify(originalValue));

    let suffix = 1;
    if (lastPart.endsWith("_js_node")) {
      const baseObj = lastPart.replace("_js_node", "");
      newKey = `${baseObj}_copy_js_node`;
      while (newKey in current) {
        suffix++;
        newKey = `${baseObj}_copy${suffix}_js_node`;
      }
    } else if (lastPart.endsWith("_ts_node")) {
      const baseObj = lastPart.replace("_ts_node", "");
      newKey = `${baseObj}_copy_ts_node`;
      while (newKey in current) {
        suffix++;
        newKey = `${baseObj}_copy${suffix}_ts_node`;
      }
    } else if (lastPart.endsWith("_py_node")) {
      const baseObj = lastPart.replace("_py_node", "");
      newKey = `${baseObj}_copy_py_node`;
      while (newKey in current) {
        suffix++;
        newKey = `${baseObj}_copy${suffix}_py_node`;
      }
    } else if (lastPart.endsWith("_api_node")) {
      const baseObj = lastPart.replace("_api_node", "");
      newKey = `${baseObj}_copy_api_node`;
      while (newKey in current) {
        suffix++;
        newKey = `${baseObj}_copy${suffix}_api_node`;
      }
    } else {
      while (newKey in current) {
        suffix++;
        newKey = `${lastPart}_copy${suffix}`;
      }
    }

    current[newKey] = valueCopy;
  }
  const parentPath = parts.slice(0, -1).join(".");
  const newPath = parentPath ? `root.${parentPath}.${newKey}` : `root.${newKey}`;
  return { newObj, newPath };
}

export function moveValueAtPath(
  obj: any,
  sourcePath: string,
  targetParentPath: string
): any {
  const parts = getParts(sourcePath);
  if (parts.length === 0) return obj;

  const lastPart = parts[parts.length - 1];

  // Get source value
  let currentSource = obj;
  for (const part of parts) {
    if (currentSource === undefined || currentSource === null) return obj;
    currentSource = currentSource[part];
  }
  const sourceValue = JSON.parse(JSON.stringify(currentSource));

  // Delete from old location
  let deletedObj = deleteValueAtPath(obj, sourcePath);

  // Set in new location
  const targetParts = getParts(targetParentPath);
  let targetObj = deletedObj;
  for (const part of targetParts) {
    if (!targetObj || typeof targetObj !== "object") return obj;
    targetObj = targetObj[part];
  }

  if (targetObj && typeof targetObj === "object") {
    let finalKey = lastPart;
    if (finalKey in targetObj) {
      let suffix = 1;
      if (lastPart.endsWith("_js_node")) {
        const base = lastPart.replace("_js_node", "");
        finalKey = `${base}_copy_js_node`;
        while (finalKey in targetObj) {
          suffix++;
          finalKey = `${base}_copy${suffix}_js_node`;
        }
      } else if (lastPart.endsWith("_ts_node")) {
        const base = lastPart.replace("_ts_node", "");
        finalKey = `${base}_copy_ts_node`;
        while (finalKey in targetObj) {
          suffix++;
          finalKey = `${base}_copy${suffix}_ts_node`;
        }
      } else if (lastPart.endsWith("_py_node")) {
        const base = lastPart.replace("_py_node", "");
        finalKey = `${base}_copy_py_node`;
        while (finalKey in targetObj) {
          suffix++;
          finalKey = `${base}_copy${suffix}_py_node`;
        }
      } else if (lastPart.endsWith("_api_node")) {
        const base = lastPart.replace("_api_node", "");
        finalKey = `${base}_copy_api_node`;
        while (finalKey in targetObj) {
          suffix++;
          finalKey = `${base}_copy${suffix}_api_node`;
        }
      } else {
        finalKey = `${lastPart}_copy`;
        while (finalKey in targetObj) {
          suffix++;
          finalKey = `${lastPart}_copy${suffix}`;
        }
      }
    }

    const destinationPath =
      targetParentPath === "root"
        ? `root.${finalKey}`
        : `${targetParentPath}.${finalKey}`;
    return setValueAtPath(deletedObj, destinationPath, sourceValue);
  }

  return obj;
}
