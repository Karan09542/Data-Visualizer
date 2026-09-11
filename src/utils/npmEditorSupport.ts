/**
 * What the JS/TS editors do for npm packages: keep Monaco's types in step with what the code
 * imports (packageTypes), and suggest package names while an import is being typed - packages
 * already on this device first, then matches from npm.
 */
import { useEffect } from "react";
import { ensurePackageTypes, findPackageImports } from "./packageTypes";
import {
  importSnippets,
  listNpmPackages,
  searchNpm,
  subscribeNpmPackages,
  type NpmPackageRecord,
} from "./npmPackages";

let devicePackages: NpmPackageRecord[] = [];
let watching = false;

/** Keeps the list of packages on this device at hand, for suggestions that need no waiting. */
function watchDevicePackages() {
  if (watching) return;
  watching = true;
  const refresh = async () => {
    devicePackages = await listNpmPackages();
  };
  void refresh();
  subscribeNpmPackages(() => void refresh());
}

/** The part of an import or require string typed so far; null when the cursor is not in one. */
export function importPrefixAt(lineUpToCursor: string): string | null {
  const match = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(["'])([^"']*)$/.exec(lineUpToCursor);
  return match ? match[2] : null;
}

const registered = new WeakSet<object>();

/** Package-name suggestions inside `import ... from "|"` and `require("|")`. */
export function registerNpmImportCompletions(monaco: any) {
  if (!monaco?.languages?.registerCompletionItemProvider || registered.has(monaco)) return;
  registered.add(monaco);
  watchDevicePackages();

  const provider = {
    triggerCharacters: ['"', "'", "/", "@"],
    async provideCompletionItems(model: any, position: any) {
      const line = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const prefix = importPrefixAt(line);
      // Relative paths are the workspace IntelliSense's business.
      if (prefix === null || prefix.startsWith(".") || prefix.startsWith("/")) return { suggestions: [] };

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - prefix.length,
        endColumn: position.column,
      };
      const kind = monaco.languages.CompletionItemKind.Module;
      const typed = prefix.toLowerCase();
      const suggestions: any[] = [];
      const listed = new Set<string>();

      for (const pkg of devicePackages) {
        if (!pkg.name.toLowerCase().startsWith(typed)) continue;
        listed.add(pkg.name);
        suggestions.push({
          label: pkg.name,
          kind,
          insertText: pkg.name,
          range,
          sortText: `0${pkg.name}`,
          detail: `On this device${pkg.version ? ` · v${pkg.version}` : ""}`,
          documentation: {
            value: [pkg.info?.description, "```js\n" + importSnippets(pkg).esm + "\n```"].filter(Boolean).join("\n\n"),
          },
        });
      }

      (await searchNpm(prefix)).forEach((result, i) => {
        if (listed.has(result.name)) return;
        suggestions.push({
          label: result.name,
          kind,
          insertText: result.name,
          range,
          sortText: `1${String(i).padStart(2, "0")}`,
          detail: `npm · v${result.version}`,
          documentation: result.description,
        });
      });

      // Asked again as more is typed, so npm's matches follow the text.
      return { suggestions, incomplete: true };
    },
  };

  monaco.languages.registerCompletionItemProvider("javascript", provider);
  monaco.languages.registerCompletionItemProvider("typescript", provider);
}

/** Package types and package-name suggestions for an editor showing this code. */
export function usePackageTypes(monaco: any, code: string | undefined, enabled = true) {
  useEffect(() => {
    if (monaco && enabled) registerNpmImportCompletions(monaco);
  }, [monaco, enabled]);

  useEffect(() => {
    if (!monaco || !enabled || !code) return;
    // After a pause in typing, so half-typed names are not looked up.
    const timer = setTimeout(() => {
      void ensurePackageTypes(monaco, findPackageImports(code));
    }, 800);
    return () => clearTimeout(timer);
  }, [monaco, code, enabled]);
}
