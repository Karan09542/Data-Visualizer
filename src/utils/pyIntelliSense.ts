import { usePyPackageStore } from "../store/usePyPackageStore";

let intelliSenseWorker: Worker | null = null;
const responsePromises = new Map<string, { resolve: (data: any) => void; reject: (err: any) => void }>();

// Lazy creation of IntelliSense web worker
export function getIntelliSenseWorker(): Worker {
  if (!intelliSenseWorker) {
    // Instantiate Python language intelligence background worker
    intelliSenseWorker = new Worker(
      new URL("./pyAutoCompleteWorker.ts", import.meta.url),
      { type: "module" }
    );

    intelliSenseWorker.onmessage = (e: MessageEvent) => {
      const { id, type, error, data } = e.data;
      const promiseObj = responsePromises.get(id);
      if (promiseObj) {
        responsePromises.delete(id);
        if (error) {
          promiseObj.reject(new Error(error));
        } else {
          promiseObj.resolve(data);
        }
      }
    };
    
    // Auto-trigger synchronizing current loaded package lists upon cold boot
    try {
      const state = usePyPackageStore.getState();
      const readyPkgs = state.installedPackages
        .filter(p => p.status === "installed")
        .map(p => p.name);
      if (readyPkgs.length > 0) {
        sendWorkerRequest("sync_packages", { packages: readyPkgs }).catch(() => {});
      }
    } catch {}
  }
  return intelliSenseWorker;
}

// Issue request to IntelliSense worker and wait for matching response callback
function sendWorkerRequest(type: string, payload: any): Promise<any> {
  const worker = getIntelliSenseWorker();
  const id = Math.random().toString(36).substring(7);
  return new Promise((resolve, reject) => {
    responsePromises.set(id, { resolve, reject });
    worker.postMessage({
      id,
      type,
      ...payload
    });
  });
}

// Map Jedi types to standard Monaco completion item kinds
function mapJediTypeToCompletionKind(type: string, monaco: any) {
  const Kinds = monaco.languages.CompletionItemKind;
  switch (type) {
    case "module":
      return Kinds.Module;
    case "class":
      return Kinds.Class;
    case "instance":
      return Kinds.Variable;
    case "function":
      return Kinds.Function;
    case "keyword":
      return Kinds.Keyword;
    case "statement":
      return Kinds.Variable;
    case "param":
      return Kinds.Property;
    case "property":
      return Kinds.Property;
    case "method":
      return Kinds.Method;
    default:
      return Kinds.Field;
  }
}

// Debounce timer mapping for real-time model syntax checking
const diagnosticsDebounceTimers = new Map<string, NodeJS.Timeout>();

export function runDiagnostics(model: any, monaco: any) {
  const modelUriStr = model.uri.toString();
  
  if (diagnosticsDebounceTimers.has(modelUriStr)) {
    clearTimeout(diagnosticsDebounceTimers.get(modelUriStr)!);
  }

  const timer = setTimeout(async () => {
    try {
      const code = model.getValue();
      const results = await sendWorkerRequest("diagnostics", {
        code,
        path: modelUriStr
      });

      if (!model.isDisposed()) {
        const markers = (results || []).map((err: any) => {
          // Fallback if index parameters are off
          const lineNum = Math.max(1, err.line);
          const startCol = Math.max(1, err.column + 1);
          
          let severity = monaco.MarkerSeverity.Error;
          if (err.type === "warning") {
            severity = monaco.MarkerSeverity.Warning;
          } else if (err.type === "info") {
            severity = monaco.MarkerSeverity.Info;
          }
          
          return {
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: startCol + 1,
            message: err.message || "Syntax Error",
            severity: severity,
            source: "Pyodide Engine"
          };
        });

        monaco.editor.setModelMarkers(model, "python-jedi-diagnostics", markers);
      }
    } catch (err) {
      console.warn("[Diagnostics]: Live syntax engine warning:", err);
    }
  }, 750); // elegant debounced delay

  diagnosticsDebounceTimers.set(modelUriStr, timer);
}

let isPyIntelliSenseRegistered = false;

export function registerPyIntelliSense(monaco: any) {
  if (isPyIntelliSenseRegistered || !monaco) return;
  isPyIntelliSenseRegistered = true;

  // console.log("[PyIntelliSense]: Registering Python language assistance providers on Monaco...");

  // Subscribe to packaging store revisions to synchronize completions dynamically inside background threads
  try {
    usePyPackageStore.subscribe((state) => {
      const readyPkgs = state.installedPackages
        .filter((p) => p.status === "installed")
        .map((p) => p.name);
      
      // Notify Jedi background worker of dynamic changes
      sendWorkerRequest("sync_packages", { packages: readyPkgs }).catch((err) => {
        console.warn("[PyIntelliSense]: Syncing packages error:", err);
      });
    });
  } catch (err) {
    console.warn("[PyIntelliSense]: Zustand subscriber linkage error:", err);
  }

  // 1. Completion Provider
  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: [".", " ", "(", ","],
    provideCompletionItems: async (model: any, position: any) => {
      try {
        const code = model.getValue();
        const results = await sendWorkerRequest("complete", {
          code,
          line: position.lineNumber,
          column: position.column,
          path: model.uri.toString()
        });

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions = (results || []).map((item: any) => {
          return {
            label: item.name,
            kind: mapJediTypeToCompletionKind(item.type, monaco),
            insertText: item.name,
            detail: item.description,
            documentation: item.docstring
              ? { value: item.docstring }
              : undefined,
            range: range
          };
        });

        return { suggestions };
      } catch (err) {
        console.warn("[PyIntelliSense]: Suggestions failed:", err);
        return { suggestions: [] };
      }
    }
  });

  // 2. Hover Provider
  monaco.languages.registerHoverProvider("python", {
    provideHover: async (model: any, position: any) => {
      try {
        const code = model.getValue();
        const results = await sendWorkerRequest("hover", {
          code,
          line: position.lineNumber,
          column: position.column,
          path: model.uri.toString()
        });

        if (!results || results.length === 0) return null;

        const contents = results.map((item: any) => {
          let val = `**${item.full_name || item.name}** (${item.type})`;
          if (item.description) {
            val += `\n\n\`\`\`python\n${item.description}\n\`\`\``;
          }
          if (item.docstring) {
            val += `\n\n${item.docstring}`;
          }
          return { value: val };
        });

        return { contents };
      } catch (err) {
        console.warn("[PyIntelliSense]: Hover failed:", err);
        return null;
      }
    }
  });

  // 3. Signature Help Provider (Display Parameter Hints / Overloads while typing)
  monaco.languages.registerSignatureHelpProvider("python", {
    signatureHelpTriggerCharacters: ["(", ","],
    signatureHelpRetriggerCharacters: [","],
    provideSignatureHelp: async (model: any, position: any) => {
      try {
        const code = model.getValue();
        const results = await sendWorkerRequest("signature", {
          code,
          line: position.lineNumber,
          column: position.column,
          path: model.uri.toString()
        });

        if (!results || results.length === 0) return null;

        // Calculate active parameter by counting commas in current parameter block
        let activeParameter = 0;
        const textToCursor = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });
        
        const openParenIndex = textToCursor.lastIndexOf("(");
        if (openParenIndex !== -1) {
          const scopeText = textToCursor.substring(openParenIndex);
          let braceDepth = 0;
          for (let i = 0; i < scopeText.length; i++) {
            const char = scopeText[i];
            if (char === "(" || char === "[" || char === "{") braceDepth++;
            else if (char === ")" || char === "]" || char === "}") braceDepth--;
            else if (char === "," && braceDepth === 1) {
              activeParameter++;
            }
          }
        }

        const signatures = results.map((sig: any) => {
          return {
            label: sig.signature_string || sig.name,
            documentation: sig.docstring ? { value: sig.docstring } : undefined,
            parameters: (sig.params || []).map((p: string) => ({ label: p }))
          };
        });

        return {
          value: {
            signatures,
            activeSignature: 0,
            activeParameter: Math.min(
              activeParameter,
              (signatures[0]?.parameters?.length || 1) - 1
            )
          },
          dispose: () => {}
        };
      } catch (err) {
        console.warn("[PyIntelliSense]: Signature help failed:", err);
        return null;
      }
    }
  });

  // 4. Definition Provider (Go To Definition)
  monaco.languages.registerDefinitionProvider("python", {
    provideDefinition: async (model: any, position: any) => {
      try {
        const code = model.getValue();
        const results = await sendWorkerRequest("definition", {
          code,
          line: position.lineNumber,
          column: position.column,
          path: model.uri.toString()
        });

        if (!results || results.length === 0) return null;

        return results.map((def: any) => {
          const targetUri = def.module_path
            ? monaco.Uri.file(def.module_path)
            : model.uri;
            
          const line = Math.max(1, def.line);
          const col = Math.max(1, def.column + 1);

          return {
            uri: targetUri,
            range: {
              startLineNumber: line,
              startColumn: col,
              endLineNumber: line,
              endColumn: col + (def.name || "").length
            }
          };
        });
      } catch (err) {
        console.warn("[PyIntelliSense]: Go to definition failed:", err);
        return null;
      }
    }
  });

  // 5. Reference Provider (Find References)
  monaco.languages.registerReferenceProvider("python", {
    provideReferences: async (model: any, position: any) => {
      try {
        const code = model.getValue();
        const results = await sendWorkerRequest("references", {
          code,
          line: position.lineNumber,
          column: position.column,
          path: model.uri.toString()
        });

        if (!results || results.length === 0) return null;

        return results.map((ref: any) => {
          const targetUri = ref.module_path
            ? monaco.Uri.file(ref.module_path)
            : model.uri;

          const line = Math.max(1, ref.line);
          const col = Math.max(1, ref.column + 1);

          return {
            uri: targetUri,
            range: {
              startLineNumber: line,
              startColumn: col,
              endLineNumber: line,
              endColumn: col + (ref.name || "").length
            }
          };
        });
      } catch (err) {
        console.warn("[PyIntelliSense]: Find references failed:", err);
        return null;
      }
    }
  });

  // 6. Connect Diagnostic Handlers on Model Creation / Modification
  monaco.editor.onDidCreateModel((model: any) => {
    if (model.getLanguageId() === "python") {
      // Run initial check
      runDiagnostics(model, monaco);
      // Run on content modification
      model.onDidChangeContent(() => {
        runDiagnostics(model, monaco);
      });
    }
  });

  // Run diagnostics for already existing Python models
  monaco.editor.getModels().forEach((model: any) => {
    if (model.getLanguageId() === "python") {
      runDiagnostics(model, monaco);
      model.onDidChangeContent(() => {
        runDiagnostics(model, monaco);
      });
    }
  });
}
