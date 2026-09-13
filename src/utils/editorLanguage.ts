/**
 * The Monaco language for a workspace node, from its key: "main_py_node" is Python, "notes_md"
 * Markdown. The same reading the code workspace gives the file it has open.
 */
export function editorLanguageFor(path: string): string {
  const ext = (path.split(".").pop() || "").replace(/\[[0-9]+\]$/, "").toLowerCase();
  const is = (suffix: string, plain: string) => ext.endsWith(suffix) || ext === plain;
  if (is("_py_node", "py")) return "python";
  if (is("_ts_node", "ts")) return "typescript";
  if (is("_js_node", "js")) return "javascript";
  if (is("_json", "json") || is("_todo_node", "todo")) return "json";
  if (is("_yaml", "yaml") || is("_yml", "yml")) return "yaml";
  if (is("_xml", "xml")) return "xml";
  if (is("_md", "md")) return "markdown";
  return "plaintext";
}

export type ExecutableKind = "ts" | "js" | "py" | "api";

/** How a node runs, when it runs at all: as TypeScript, JavaScript, Python, or an API request. */
export function executableKindFor(path: string): ExecutableKind | null {
  const ext = (path.split(".").pop() || "").replace(/\[[0-9]+\]$/, "").toLowerCase();
  const is = (suffix: string, plain: string) => ext.endsWith(suffix) || ext === plain;
  if (is("_ts_node", "ts")) return "ts";
  if (is("_js_node", "js")) return "js";
  if (is("_py_node", "py")) return "py";
  if (is("_api_node", "api")) return "api";
  return null;
}
