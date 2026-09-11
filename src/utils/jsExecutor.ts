/**
 * JavaScript nodes. They run through the executor JS and TS nodes share (codeNodeExecutor); this
 * file keeps the entry points the components import.
 */
import { abortCodeNode, executeCodeNode } from "./codeNodeExecutor";

export const abortJsNode = (path: string) => abortCodeNode(path);

export const executeJsNode = (path: string, codeToRun: string) =>
  executeCodeNode(path, codeToRun, { language: "js" });
