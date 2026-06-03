/**
 * Safe stringification helper that avoids throwing errors on circular JSON references,
 * DOM elements/Nodes, React fibers, or any other cyclic values.
 */
export function safeStringify(obj: any, indent?: number | string): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        // Special safe handling for DOM elements or XML Nodes
        if (
          (typeof Node !== "undefined" && value instanceof Node) || 
          (typeof value.nodeType === "number" && typeof value.nodeName === "string")
        ) {
          const tagName = value.nodeName ? value.nodeName.toLowerCase() : "element";
          const idStr = value.id ? `#${value.id}` : "";
          const clsStr = value.className && typeof value.className === "string" 
            ? `.${value.className.trim().split(/\s+/).join(".")}` 
            : "";
          return `[HTMLElement <${tagName}${idStr}${clsStr}>]`;
        }

        // Special safe handling for window, global, or highly circular environments
        if (value === window || value === globalThis) {
          return "[GlobalWindow]";
        }

        // Cycle detection
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
        
        // Remove common internal React fiber properties that might lead to massive graphs
        if (key.startsWith("__reactFiber") || key.startsWith("__reactProps") || key.startsWith("__reactEvents")) {
          return "[ReactInternal]";
        }
      }
      
      // Handle BigInt values gracefully in JSON stringification
      if (typeof value === "bigint") {
        return value.toString() + "n";
      }

      // Handle function string representation gracefully
      if (typeof value === "function") {
        return `[Function: ${value.name || "anonymous"}]`;
      }

      return value;
    }, indent);
  } catch (err) {
    return `[Unserializable: ${err instanceof Error ? err.message : String(err)}]`;
  }
}
