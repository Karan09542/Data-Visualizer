/**
 * TypeScript nodes: Monaco's type check first, then the executor JS and TS nodes share
 * (codeNodeExecutor). Also the input-type generator the TS editor uses.
 */
import { abortCodeNode, executeCodeNode } from "./codeNodeExecutor";

export const abortTsNode = (path: string) => abortCodeNode(path);

export const executeTsNode = (
  path: string,
  codeToRun: string,
  monacoInstance?: any,
) =>
  executeCodeNode(path, codeToRun, {
    language: "ts",
    beforeRun: () => typeCheck(path, codeToRun, monacoInstance),
  });

/**
 * Type errors from Monaco's TypeScript service for this node's code, as the message to show; null
 * when there are none or Monaco is not loaded. Missing-module errors (2307, 7016) are ignored, so
 * npm packages - which Monaco has no types for - do not block a run.
 */
async function typeCheck(
  path: string,
  codeToRun: string,
  monacoInstance?: any,
): Promise<string | null> {
  // Type Check Phase using Monaco Language Service
  const monaco = monacoInstance || (window as any).monaco;
  let typeErrors: string[] = [];

  if (monaco) {
    try {
      const models = monaco.editor.getModels();
      // Find a typescript model corresponding to this code or path
      const tsModel = models.find((m: any) => {
        if (m.getLanguageId() !== "typescript") return false;
        const modelVal = m.getValue().trim();
        const targetVal = codeToRun.trim();
        return (
          modelVal === targetVal ||
          modelVal.includes(targetVal) ||
          targetVal.includes(modelVal) ||
          m.uri.toString().includes(path)
        );
      });

      if (tsModel) {
        try {
          const getWorker =
            await monaco.languages.typescript.getTypeScriptWorker();
          const worker = await getWorker(tsModel.uri);
          const syntactic = await worker.getSyntacticDiagnostics(
            tsModel.uri.toString(),
          );
          const semantic = await worker.getSemanticDiagnostics(
            tsModel.uri.toString(),
          );

          [...syntactic, ...semantic].forEach((diag: any) => {
            if (diag.code === 2451 || diag.code === 2300 || diag.code === 2307 || diag.code === 7016) return; // Ignore global scope clashes & module resolution
            const start = diag.start || 0;
            const position = tsModel.getPositionAt(start);
            const line = position ? position.lineNumber : 1;
            const col = position ? position.column : 1;
            let messageText = diag.messageText;
            if (typeof messageText === "object" && messageText !== null) {
              messageText =
                messageText.messageText || JSON.stringify(messageText);
            }
            typeErrors.push(
              `TS${diag.code || "Error"}: ${messageText} (Line ${line}, Col ${col})`,
            );
          });
        } catch (diagErr) {
          console.warn(
            "Direct TS Worker diagnostics failed, falling back to editor markers",
            diagErr,
          );
          const markers = monaco.editor.getModelMarkers({
            resource: tsModel.uri,
          });
          const errorMarkers = markers.filter(
            (m: any) =>
              m.severity === 8 &&
              m.code !== "2451" &&
              m.code !== "2300" &&
              m.code !== "2307" &&
              m.code !== "7016" &&
              m.code !== 2451 &&
              m.code !== 2300 &&
              m.code !== 2307 &&
              m.code !== 7016,
          ); // MarkerSeverity.Error is 8
          if (errorMarkers.length > 0) {
            typeErrors = errorMarkers.map(
              (m: any) =>
                `TS${m.code || "Error"}: ${m.message} (Line ${m.startLineNumber}, Col ${m.startColumn})`,
            );
          }
        }
      }
    } catch (monacoErr) {
      console.warn("Monaco diagnostics check failed", monacoErr);
    }
  }

  return typeErrors.length > 0
    ? `TypeScript Type Compilation Failed:\n\n${typeErrors.join("\n")}`
    : null;
}

export function generateTypeScriptSchema(
  val: any,
  interfaceName: string = "Input",
): { types: string; entry: string } {
  if (val === undefined || val === null) {
    return { types: `interface ${interfaceName} {}`, entry: "" };
  }

  const customTypes: string[] = [];

  function walk(currentVal: any, name: string): string {
    if (currentVal === null) return "any";
    if (Array.isArray(currentVal)) {
      if (currentVal.length === 0) return "any[]";
      const elemType = walk(currentVal[0], name + "Item");
      return `${elemType}[]`;
    }
    if (typeof currentVal === "object") {
      const fields: string[] = [];
      for (const [key, v] of Object.entries(currentVal)) {
        const propName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
          ? key
          : JSON.stringify(key);
        const childTypeName = name + key.charAt(0).toUpperCase() + key.slice(1);
        const t = walk(v, childTypeName);
        fields.push(`  ${propName}: ${t};`);
      }
      const typeStr = `interface ${name} {\n${fields.join("\n")}\n}`;
      customTypes.push(typeStr);
      return name;
    }
    return typeof currentVal;
  }

  const rootType = walk(val, interfaceName);

  let finalTypes = customTypes.join("\n\n");
  if (rootType !== interfaceName) {
    finalTypes = `type ${interfaceName} = ${rootType};\n\n` + finalTypes;
  }

  return {
    types: finalTypes,
    entry: "",
  };
}
