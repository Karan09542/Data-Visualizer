export function safeStringify(obj: any, indent?: number | string): string {
  if (obj === undefined) {
    return "undefined";
  }
  const seen = new WeakSet();
  try {
    const str = JSON.stringify(
      obj,
      (key, value) => {
        if (value === undefined) {
          return "__UNDEFINED_PLACEHOLDER__";
        }
        if (typeof value === "number") {
          if (Number.isNaN(value)) return "__NAN_PLACEHOLDER__";
          if (value === Infinity) return "__INFINITY_PLACEHOLDER__";
          if (value === -Infinity) return "__NEG_INFINITY_PLACEHOLDER__";
        }
        if (typeof value === "object" && value !== null) {
          // Special safe handling for DOM elements or XML Nodes
          if (
            (typeof Node !== "undefined" && value instanceof Node) ||
            (typeof value.nodeType === "number" &&
              typeof value.nodeName === "string")
          ) {
            const tagName = value.nodeName
              ? value.nodeName.toLowerCase()
              : "element";
            const idStr = value.id ? `#${value.id}` : "";
            const clsStr =
              value.className && typeof value.className === "string"
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
          if (
            key.startsWith("__reactFiber") ||
            key.startsWith("__reactProps") ||
            key.startsWith("__reactEvents")
          ) {
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
        
        // Handle symbol
        if (typeof value === "symbol") {
          return value.toString();
        }

        return value;
      },
      indent,
    );

    if (typeof str === "string") {
      return str
        .replace(/"__UNDEFINED_PLACEHOLDER__"/g, "undefined")
        .replace(/"__NAN_PLACEHOLDER__"/g, "NaN")
        .replace(/"__INFINITY_PLACEHOLDER__"/g, "Infinity")
        .replace(/"__NEG_INFINITY_PLACEHOLDER__"/g, "-Infinity");
    }
    return str;
  } catch (err) {
    return `[Unserializable: ${err instanceof Error ? err.message : String(err)}]`;
  }
}
