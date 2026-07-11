import { useStore } from "../store/useStore";
import { buildVirtualFS } from "./vfs";

let isRegistered = false;
let currentMonaco: any = null;

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

function resolveRelative(baseDir: string, relPath: string) {
  const parts = baseDir.split("/").filter(Boolean);
  for (const p of relPath.split("/")) {
    if (p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return "/" + parts.join("/");
}

function computeRelative(fromDir: string, toFsPath: string) {
  const fromParts = fromDir.split("/").filter(Boolean);
  const toParts = toFsPath.split("/").filter(Boolean);

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++;
  }

  const up = fromParts.length - common;
  const upStr = up === 0 ? "./" : "../".repeat(up);
  const rest = toParts.slice(common).join("/");

  let res = upStr + rest;
  if (!res.startsWith(".")) res = "./" + res;
  return res;
}

export function performWorkspaceRenameScope(
  parsedData: any,
  oldVfsPath: string,
  newVfsPath: string,
) {
  const updatedData = JSON.parse(JSON.stringify(parsedData));

  function traverseAndUpdate(obj: any, currentFsPath: string) {
    if (typeof obj !== "object" || obj === null) return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "string") {
        const isCode =
          key.endsWith("_ts_node") ||
          key.endsWith("_js_node") ||
          key.endsWith(".ts") ||
          key.endsWith(".js") ||
          key.endsWith(".py") ||
          key.endsWith("_py_node");
        if (isCode) {
          const baseName = cleanNodeName(key);
          const filePath = currentFsPath
            ? `${currentFsPath}/${baseName}`
            : `/${baseName}`;
          const fileDir =
            filePath.substring(0, filePath.lastIndexOf("/")) || "";

          // Replace string content
          let newCode = val;
          // matches: import ... from "...", import("..."), require("...")
          const regex =
            /(import\s+[^'"]*from\s+['"]|import\s*\(?\s*['"]|require\s*\(\s*['"])([^'"]+)(['"]\)?)/g;
          newCode = newCode.replace(regex, (match, prefix, relPath, suffix) => {
            if (relPath.startsWith(".")) {
              const absPath = resolveRelative(fileDir, relPath);
              if (absPath === oldVfsPath) {
                // Update import path!
                let newRel = computeRelative(fileDir, newVfsPath);
                // if it didn't have extension before, maybe keep it that way if it was implicitly resolving
                if (
                  !relPath.endsWith(".js") &&
                  !relPath.endsWith(".ts") &&
                  !relPath.endsWith(".json")
                ) {
                  if (newRel.endsWith(".js") || newRel.endsWith(".ts")) {
                    newRel = newRel.replace(/\.[tj]sx?$/, ""); // remove extension if it was implicit
                  }
                }
                return prefix + newRel + suffix;
              }
            }
            return match;
          });

          obj[key] = newCode;
        }
      } else if (typeof val === "object") {
        const nextPath = currentFsPath
          ? `${currentFsPath}/${cleanNodeName(key)}`
          : `/${cleanNodeName(key)}`;
        traverseAndUpdate(val, nextPath);
      }
    }
  }

  traverseAndUpdate(updatedData, "");
  return updatedData;
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

// Extracted logic to update Monaco Models so TS language server knows about files
export function syncWorkspaceModelsToMonaco(monaco: any, parsedData: any) {
  if (!monaco) return;
  const vfs = buildVirtualFS(parsedData);

  // We should create monaco.editor.createModel for every file
  // so that TS server can provide cross-file intellisense
  const availableUris = new Set<string>();

  for (const [path, content] of Object.entries(vfs)) {
    const uri = monaco.Uri.file(path);
    availableUris.add(uri.toString());

    let lang = "plaintext";
    if (path.endsWith(".ts")) lang = "typescript";
    else if (path.endsWith(".js")) lang = "javascript";
    else if (path.endsWith(".json")) lang = "json";
    else if (path.endsWith(".py")) lang = "python";
    else if (path.endsWith(".md")) lang = "markdown";
    else if (path.endsWith(".html")) lang = "html";
    else if (path.endsWith(".css")) lang = "css";

    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(content, lang, uri);
    } else {
      if (model.getLanguageId?.() !== lang) {
        monaco.editor.setModelLanguage(model, lang);
      }
      if (model.getValue() !== content) {
        model.setValue(content);
      }
    }
  }

  // Dispose of old models not in VFS anymore
  monaco.editor.getModels().forEach((model: any) => {
    if (
      model.uri.scheme === "file" &&
      !availableUris.has(model.uri.toString())
    ) {
      model.dispose();
    }
  });

  return vfs;
}

export function registerWorkspaceIntelliSense(monaco: any, editor: any) {
  currentMonaco = monaco;

  // Hook the editor open request to open our React tabs!
  if (editor && editor._codeEditorService) {
    const editorService = editor._codeEditorService;
    if (!editorService.__isIntercepted) {
      const openEditorBase = editorService.openCodeEditor.bind(editorService);
      editorService.openCodeEditor = async (
        input: any,
        source: any,
        sideBySide: any,
      ) => {
        const resource = input.resource;
        if (resource && resource.scheme === "file") {
          let reqPath = resource.path; // e.g. /src/utils/api.ts

          const state = useStore.getState();
          const vmap = buildVfsMap(state.parsedData);

          let objectPath = vmap[reqPath];

          // Fallback if not found natively
          if (!objectPath) {
            if (reqPath.startsWith("/")) reqPath = reqPath.substring(1);
            objectPath = reqPath;
          }

          state.openWorkspaceTab(objectPath);

          if (input.options?.selection) {
            setTimeout(() => {
              state.setJsNodeFocusLine(
                objectPath,
                input.options.selection.startLineNumber,
              );
            }, 50);
          }
          return null; // Don't let Monaco actually try to open it physically
        }
        return openEditorBase(input, source, sideBySide);
      };
      editorService.__isIntercepted = true;
    }
  }

  if (isRegistered || !monaco) return;
  isRegistered = true;

  const languages = ["javascript", "typescript"];

  // 1. Completion Provider for Import Paths
  languages.forEach((lang) => {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['"', "'", "/", "."],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const importMatch = textUntilPosition.match(
          /(import|require)\s*\(?\s*['"]([^'"]*)$/,
        );
        // also support `import ... from "..."` and `import type ... from "..."`
        const fromMatch = textUntilPosition.match(/from\s*['"]([^'"]*)$/);

        let typedPath = "";
        if (importMatch) typedPath = importMatch[2];
        else if (fromMatch) typedPath = fromMatch[1];
        else return { suggestions: [] };

        const parsedData = useStore.getState().parsedData;
        const vfs = buildVirtualFS(parsedData);

        const currentPath = model.uri.path; // e.g. /src/utils/api.ts
        const currentDir =
          currentPath.substring(0, currentPath.lastIndexOf("/")) || "";

        // resolve typedPath against currentDir
        let targetDir = currentDir;
        let prefix = typedPath;

        if (typedPath.startsWith("./") || typedPath.startsWith("../")) {
          const parts = currentDir.split("/").filter(Boolean);
          const pathParts = typedPath.split("/");
          prefix = pathParts.pop() || "";

          for (const p of pathParts) {
            if (p === ".") continue;
            if (p === "..") parts.pop();
            else parts.push(p);
          }
          targetDir = "/" + parts.join("/");
        }

        const suggestions: any[] = [];
        const addedNames = new Set<string>();

        for (const vfsPath of Object.keys(vfs)) {
          if (!vfsPath.startsWith(targetDir)) continue;

          let rel = vfsPath.substring(targetDir.length);
          if (rel.startsWith("/")) rel = rel.substring(1);

          const parts = rel.split("/");
          const isFile = parts.length === 1;
          const name = parts[0];

          if (!name.startsWith(prefix)) continue;
          if (addedNames.has(name)) continue;
          addedNames.add(name);

          if (isFile) {
            let kind = monaco.languages.CompletionItemKind.File;
            if (name.endsWith(".json"))
              kind = monaco.languages.CompletionItemKind.Value;
            else if (name.endsWith(".js") || name.endsWith(".ts"))
              kind = monaco.languages.CompletionItemKind.Module;
            else if (name.endsWith(".md"))
              kind = monaco.languages.CompletionItemKind.Text;

            suggestions.push({
              label: name,
              kind,
              insertText: name,
              detail: "File",
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - prefix.length,
                endColumn: position.column,
              },
            });
          } else {
            suggestions.push({
              label: name,
              kind: monaco.languages.CompletionItemKind.Folder,
              insertText: name + "/",
              detail: "Folder",
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - prefix.length,
                endColumn: position.column,
              },
            });
          }
        }

        return { suggestions };
      },
    });

    // 2. JSON Hover Preview
    monaco.languages.registerHoverProvider(lang, {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        const lineContent = model.getLineContent(position.lineNumber);
        const importMatch = lineContent.match(
          /(import|require|from)\s*\(?\s*['"]([^'"]*\.json)['"]/,
        );

        if (importMatch) {
          const range = new monaco.Range(
            position.lineNumber,
            importMatch.index! + importMatch[0].lastIndexOf(importMatch[2]),
            position.lineNumber,
            importMatch.index! +
              importMatch[0].lastIndexOf(importMatch[2]) +
              importMatch[2].length,
          );
          if (range.containsPosition(position)) {
            const relPath = importMatch[2];
            const currentDir =
              model.uri.path.substring(0, model.uri.path.lastIndexOf("/")) ||
              "";
            const absPath = resolveRelative(currentDir, relPath);

            const vfs = buildVirtualFS(useStore.getState().parsedData);
            if (vfs[absPath]) {
              const parsed = JSON.parse(vfs[absPath] || "{}");
              const preview = JSON.stringify(parsed, null, 2).substring(0, 500); // truncate if big
              return {
                range,
                contents: [
                  {
                    value: `**JSON Asset Preview:**\n\`\`\`json\n${preview}${preview.length === 500 ? "..." : ""}\n\`\`\``,
                  },
                ],
              };
            }
          }
        }
        return null;
      },
    });

    // 3. Definition Provider for all relative imports
    monaco.languages.registerDefinitionProvider(lang, {
      provideDefinition: (model: any, position: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        // Find all import/require strings on this line
        const regex =
          /(import\s+[^'"]*from\s+['"]|import\s*\(?\s*['"]|require\s*\(\s*['"])([^'"]+)(['"]\)?)/g;
        let match;
        while ((match = regex.exec(lineContent)) !== null) {
          const prefix = match[1];
          const relPath = match[2];
          const startCol = match.index + prefix.length + 1;
          const endCol = startCol + relPath.length;

          if (position.column >= startCol && position.column <= endCol) {
            const currentDir =
              model.uri.path.substring(0, model.uri.path.lastIndexOf("/")) ||
              "";
            let absPath = "";

            if (relPath.startsWith(".")) {
              absPath = resolveRelative(currentDir, relPath);
            } else if (relPath.startsWith("/")) {
              absPath = relPath;
            } else {
              continue; // e.g. node_modules, do not hook
            }

            // Try to find it in VFS
            const parsedData = useStore.getState().parsedData;
            const vfs = buildVirtualFS(parsedData);

            let targetFsPath = absPath;
            if (!vfs[targetFsPath]) {
              // implicit extensions
              if (vfs[absPath + ".js"]) targetFsPath = absPath + ".js";
              else if (vfs[absPath + ".ts"]) targetFsPath = absPath + ".ts";
              else if (vfs[absPath + ".py"]) targetFsPath = absPath + ".py";
              else if (vfs[absPath + ".json"]) targetFsPath = absPath + ".json";
              else if (vfs[absPath + "/index.js"])
                targetFsPath = absPath + "/index.js";
              else if (vfs[absPath + "/index.ts"])
                targetFsPath = absPath + "/index.ts";
            }

            if (vfs[targetFsPath]) {
              return {
                uri: monaco.Uri.file(targetFsPath),
                range: new monaco.Range(1, 1, 1, 1),
              };
            }
          }
        }
        return null;
      },
    });
  });
}
