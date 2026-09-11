/**
 * Making any value safe to send through postMessage.
 *
 * postMessage copies with the structured clone algorithm, which refuses symbols, functions, DOM
 * nodes and promises - and refuses the whole message when one value anywhere inside it is one of
 * those. A single `console.log` of a zod schema (it carries a Symbol) used to lose the entire
 * batch of logs, reported as "Log Serialization Error".
 *
 * `postCloneable` sends the message untouched first, so ordinary messages cost nothing extra, and
 * only converts when the browser refuses. Nothing here throws: a message always gets through, at
 * worst as a description of what could not be copied.
 *
 * Plain JavaScript on purpose: the JS/TS node worker is built as a string and includes this file's
 * source, while other workers import it as a module.
 */

/** Deeper than this and the shape is reported rather than walked. */
const MAX_DEPTH = 64;
/** Values visited per conversion, so a huge or endlessly generated structure cannot hang a worker. */
const MAX_NODES = 100000;

/** Values the structured clone algorithm already copies. */
function __dvIsNativelyCloneable(value) {
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return true;
  const names = ["Date", "RegExp", "Blob", "File", "FileList", "ImageData", "ImageBitmap", "DOMException"];
  for (let i = 0; i < names.length; i++) {
    const ctor = globalThis[names[i]];
    if (typeof ctor === "function" && value instanceof ctor) return true;
  }
  return false;
}

/** Elements and the like: recognised by shape, since Node is not defined inside a worker. */
function __dvDescribeNode(value) {
  const tag = typeof value.nodeName === "string" ? value.nodeName.toLowerCase() : "node";
  const id = typeof value.id === "string" && value.id ? "#" + value.id : "";
  return "[Element <" + tag + id + ">]";
}

/**
 * The same value, with everything postMessage cannot copy replaced by something it can.
 *
 * `path` holds the objects being walked right now, so a value that refers back to itself is
 * marked rather than followed for ever.
 */
function __dvToCloneable(value, path, budget, depth) {
  path = path || new Set();
  budget = budget || { left: MAX_NODES };
  depth = depth || 0;

  const type = typeof value;
  if (value === null || type === "string" || type === "number" || type === "boolean" || type === "undefined" || type === "bigint") {
    return value;
  }
  if (type === "symbol") return String(value);
  if (type === "function") return "[Function: " + (value.name || "anonymous") + "]";
  if (__dvIsNativelyCloneable(value)) return value;
  if (depth >= MAX_DEPTH) return "[Nested too deeply]";
  if (budget.left <= 0) return "[Too large to show]";
  if (path.has(value)) return "[Circular]";

  budget.left--;
  path.add(value);
  try {
    const child = function (v) {
      return __dvToCloneable(v, path, budget, depth + 1);
    };

    if (Array.isArray(value)) return value.map(child);
    if (typeof value.nodeType === "number" && typeof value.nodeName === "string") return __dvDescribeNode(value);
    if (typeof Promise === "function" && value instanceof Promise) return "[Promise]";

    if (value instanceof Map) {
      const out = new Map();
      value.forEach(function (v, k) {
        out.set(child(k), child(v));
      });
      return out;
    }
    if (value instanceof Set) {
      const out = new Set();
      value.forEach(function (v) {
        out.add(child(v));
      });
      return out;
    }
    if (value instanceof Error) {
      // Kept as a plain object: an Error subclass can carry anything in its own fields.
      const out = { name: String(value.name), message: String(value.message), stack: String(value.stack || "") };
      Object.keys(value).forEach(function (key) {
        if (key in out) return;
        try {
          out[key] = child(value[key]);
        } catch (err) {
          out[key] = "[Unreadable]";
        }
      });
      return out;
    }

    // Anything else, including class instances: its own readable fields, as a plain object.
    // Symbol-keyed fields are left out; structured clone drops them anyway.
    const out = {};
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      try {
        out[keys[i]] = child(value[keys[i]]);
      } catch (err) {
        out[keys[i]] = "[Unreadable]"; // a getter that throws
      }
    }
    return out;
  } catch (err) {
    return "[Unreadable]";
  } finally {
    path.delete(value);
  }
}

/**
 * Posts a message, converting it only if this browser refuses to copy it as it is. Returns
 * "sent", "converted", or "failed" - and never throws.
 *
 * `transfer` hands buffers over instead of copying them. If that fails the converted copy is sent
 * without it, so the message still arrives.
 */
function __dvPostCloneable(target, message, transfer) {
  try {
    if (transfer && transfer.length) target.postMessage(message, transfer);
    else target.postMessage(message);
    return "sent";
  } catch (err) {
    try {
      target.postMessage(__dvToCloneable(message));
      return "converted";
    } catch (err2) {
      try {
        target.postMessage({
          type: "logs",
          logs: [{ type: "error", args: ["A message could not be sent from the worker: " + (err2 && err2.message ? err2.message : String(err2))], time: "" }],
        });
      } catch (err3) {
        // Nothing more can be done from here.
      }
      return "failed";
    }
  }
}

export { __dvToCloneable, __dvPostCloneable };
