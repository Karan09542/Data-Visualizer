/**
 * Capturing logged values the way a terminal shows them.
 *
 * `console.log(schema)` must survive the trip out of a worker, and copying to the page keeps only
 * plain data: class names, functions, symbols and sizes are all lost, which is why a zod schema
 * arrived as a wall of JSON. So each value is captured where it is logged, as a small description
 * of itself - what it is, what it is called, what it contains - which the console renders with
 * collapsible rows.
 *
 * Captures are bounded: so many levels deep, so many entries per level, and a ceiling on the whole
 * thing. What is left out is counted, so the console can say "12 more".
 *
 * Plain JavaScript on purpose: the JS/TS node worker is built as a string and includes this file's
 * source, while the page imports it as a module.
 */

/**
 * Generous on purpose: what is captured is all that can ever be copied, since the worker is gone
 * by the time anyone asks. The console shows only a little of it at a time, so a big capture
 * costs nothing to display.
 */
const DEFAULTS = {
  depth: 8,
  /** Object properties kept per level. */
  entries: 2000,
  /** Array items kept; the console groups them as it shows them. */
  items: 5000,
  /** Longer strings are cut, with the full length remembered. */
  string: 100000,
  /** Values captured in total, so one enormous object cannot fill the log. */
  budget: 20000,
};

/** What kind of function it is, as a terminal would label it. */
function __dvFunctionKind(value) {
  const source = Function.prototype.toString.call(value).slice(0, 24);
  if (/^\s*class[\s{]/.test(source)) return "class";
  if (/^\s*async/.test(source)) return "async";
  if (/^\s*function\s*\*/.test(source)) return "generator";
  return "function";
}

/** The constructor name worth showing: "ZodObject", but not "Object". */
function __dvConstructorName(value) {
  try {
    const name = value.constructor && value.constructor.name;
    if (!name || name === "Object") return undefined;
    return String(name);
  } catch (err) {
    return undefined; // a null-prototype object, or a throwing getter
  }
}

function __dvElementText(value) {
  const tag = typeof value.nodeName === "string" ? value.nodeName.toLowerCase() : "node";
  const id = typeof value.id === "string" && value.id ? `#${value.id}` : "";
  let classes = "";
  try {
    if (typeof value.className === "string" && value.className.trim()) {
      classes = `.${value.className.trim().split(/\s+/).join(".")}`;
    }
  } catch (err) {
    // Not an element after all.
  }
  return `<${tag}${id}${classes}>`;
}

/**
 * A description of `value` for the console: plain data, safe to copy between threads.
 * Strings, finite numbers, booleans and null are kept as they are; everything else is described.
 */
function __dvCapture(value, options) {
  if (__dvIsCapture(value)) return value; // already described, by the worker
  const limits = Object.assign({}, DEFAULTS, options || {});
  const state = { budget: limits.budget, path: new Set() };
  return __dvCaptureInner(value, limits, state, 0);
}

function __dvCaptureInner(value, limits, state, depth) {
  const type = typeof value;

  if (value === null || type === "boolean") return value;
  if (type === "number") {
    return Number.isFinite(value) ? value : { dv: 1, t: "number", text: String(value) };
  }
  if (type === "undefined") return { dv: 1, t: "undefined" };
  if (type === "bigint") return { dv: 1, t: "bigint", text: `${value}n` };
  if (type === "symbol") return { dv: 1, t: "symbol", text: String(value) };
  if (type === "string") {
    return value.length > limits.string
      ? { dv: 1, t: "string", text: value.slice(0, limits.string), length: value.length }
      : value;
  }
  if (type === "function") {
    return { dv: 1, t: "function", name: value.name || "", kind: __dvFunctionKind(value) };
  }

  if (state.budget <= 0) return { dv: 1, t: "cut", reason: "size" };
  if (state.path.has(value)) return { dv: 1, t: "circular" };
  state.budget--;

  try {
    if (value instanceof Date) return { dv: 1, t: "date", iso: isNaN(value.getTime()) ? "Invalid Date" : value.toISOString() };
    if (value instanceof RegExp) return { dv: 1, t: "regexp", text: String(value) };
    if (typeof Promise === "function" && value instanceof Promise) return { dv: 1, t: "promise" };
    if (typeof value.nodeType === "number" && typeof value.nodeName === "string") {
      return { dv: 1, t: "element", text: __dvElementText(value) };
    }
    if (value instanceof Error) {
      return {
        dv: 1,
        t: "error",
        name: String(value.name || "Error"),
        message: String(value.message || ""),
        stack: String(value.stack || ""),
      };
    }
  } catch (err) {
    return { dv: 1, t: "unreadable" };
  }

  const child = (v) => __dvCaptureInner(v, limits, state, depth + 1);
  const tooDeep = depth >= limits.depth;

  try {
    state.path.add(value);

    if (Array.isArray(value)) {
      if (tooDeep) return { dv: 1, t: "cut", reason: "depth", label: `Array(${value.length})` };
      const keep = Math.min(value.length, limits.items);
      const items = [];
      for (let i = 0; i < keep; i++) items.push(child(value[i]));
      return { dv: 1, t: "array", len: value.length, items, more: value.length - keep };
    }

    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      if (tooDeep) return { dv: 1, t: "cut", reason: "depth", label: `${__dvConstructorName(value) || "TypedArray"}(${value.length})` };
      const keep = Math.min(value.length, limits.items);
      const items = [];
      for (let i = 0; i < keep; i++) items.push(value[i]);
      return { dv: 1, t: "array", ctor: __dvConstructorName(value), len: value.length, items, more: value.length - keep };
    }

    if (value instanceof Map) {
      if (tooDeep) return { dv: 1, t: "cut", reason: "depth", label: `Map(${value.size})` };
      const entries = [];
      let skipped = 0;
      value.forEach((v, k) => {
        if (entries.length < limits.entries) entries.push([child(k), child(v)]);
        else skipped++;
      });
      return { dv: 1, t: "map", size: value.size, entries, more: skipped };
    }

    if (value instanceof Set) {
      if (tooDeep) return { dv: 1, t: "cut", reason: "depth", label: `Set(${value.size})` };
      const items = [];
      let skipped = 0;
      value.forEach((v) => {
        if (items.length < limits.entries) items.push(child(v));
        else skipped++;
      });
      return { dv: 1, t: "set", size: value.size, items, more: skipped };
    }

    const ctor = __dvConstructorName(value);
    if (tooDeep) return { dv: 1, t: "cut", reason: "depth", label: ctor || "Object" };

    let keys;
    try {
      keys = Object.keys(value);
    } catch (err) {
      return { dv: 1, t: "unreadable" };
    }
    const entries = [];
    const keep = Math.min(keys.length, limits.entries);
    for (let i = 0; i < keep; i++) {
      const key = keys[i];
      try {
        entries.push([key, child(value[key])]);
      } catch (err) {
        entries.push([key, { dv: 1, t: "unreadable" }]); // a getter that throws
      }
    }
    return { dv: 1, t: "object", ctor, entries, more: keys.length - keep };
  } catch (err) {
    return { dv: 1, t: "unreadable" };
  } finally {
    state.path.delete(value);
  }
}

/** Whether this is already a capture, rather than a value still to be captured. */
function __dvIsCapture(value) {
  return !!value && typeof value === "object" && value.dv === 1 && typeof value.t === "string";
}

/** How a capture reads as plain text, for copying - the same shape the console shows. */
function __dvText(value, depth) {
  depth = depth || 0;
  const node = __dvIsCapture(value) ? value : __dvCapture(value);
  if (!__dvIsCapture(node)) {
    if (typeof node === "string") return depth === 0 ? node : `'${node}'`;
    return String(node);
  }

  const list = (parts, open, close, more, label) => {
    const all = more > 0 ? parts.concat([`\u2026 ${more} more`]) : parts;
    const body = all.join(", ");
    return `${label || ""}${open}${body ? ` ${body} ` : ""}${close}`;
  };
  const child = (v) => __dvText(v, depth + 1);

  switch (node.t) {
    case "undefined":
      return "undefined";
    case "number":
    case "bigint":
    case "symbol":
    case "regexp":
    case "element":
      return node.text;
    case "string":
      return depth === 0 ? node.text : `'${node.text}'`;
    case "function":
      return node.kind === "class"
        ? `[class ${node.name || "(anonymous)"}]`
        : `[Function: ${node.name || "(anonymous)"}]`;
    case "date":
      return node.iso;
    case "promise":
      return "Promise";
    case "circular":
      return "[Circular]";
    case "unreadable":
      return "[Unreadable]";
    case "cut":
      return node.reason === "depth" ? `[${node.label}]` : "[Too large to capture]";
    case "error":
      return node.stack || `${node.name}: ${node.message}`;
    case "array":
      return list(node.items.map(child), "[", "]", node.more, node.ctor ? `${node.ctor} ` : "");
    case "object":
      return list(
        node.entries.map(([key, value]) => `${key}: ${child(value)}`),
        "{",
        "}",
        node.more,
        node.ctor ? `${node.ctor} ` : "",
      );
    case "map":
      return list(
        node.entries.map(([key, value]) => `${child(key)} => ${child(value)}`),
        "{",
        "}",
        node.more,
        `Map(${node.size}) `,
      );
    case "set":
      return list(node.items.map(child), "{", "}", node.more, `Set(${node.size}) `);
    default:
      return String(node.t);
  }
}

/** A whole log line as text. */
function __dvLogText(args) {
  return (args || []).map((arg) => __dvText(arg, 0)).join(" ");
}

/** A capture as plain JSON, for copying into a file. What cannot be JSON is described in words. */
function __dvJson(value) {
  const node = __dvIsCapture(value) ? value : __dvCapture(value);
  if (!__dvIsCapture(node)) return node;

  switch (node.t) {
    case "undefined":
      return null;
    case "number":
    case "bigint":
    case "string":
    case "symbol":
    case "regexp":
    case "element":
      return node.text;
    case "function":
      return node.kind === "class"
        ? `[class ${node.name || "(anonymous)"}]`
        : `[Function: ${node.name || "(anonymous)"}]`;
    case "date":
      return node.iso;
    case "promise":
      return "[Promise]";
    case "circular":
      return "[Circular]";
    case "unreadable":
      return "[Unreadable]";
    case "cut":
      return node.reason === "depth" ? `[${node.label}]` : "[Too large to capture]";
    case "error":
      return { name: node.name, message: node.message, stack: node.stack };
    case "array": {
      const out = node.items.map(__dvJson);
      if (node.more > 0) out.push(`\u2026 ${node.more} more`);
      return out;
    }
    case "set": {
      const out = node.items.map(__dvJson);
      if (node.more > 0) out.push(`\u2026 ${node.more} more`);
      return out;
    }
    case "map": {
      const out = node.entries.map(([key, value]) => [__dvJson(key), __dvJson(value)]);
      if (node.more > 0) out.push([`\u2026 ${node.more} more`, null]);
      return out;
    }
    case "object": {
      const out = {};
      node.entries.forEach(([key, value]) => {
        out[key] = __dvJson(value);
      });
      if (node.more > 0) out["\u2026"] = `${node.more} more properties`;
      return out;
    }
    default:
      return String(node.t);
  }
}

export { __dvCapture, __dvIsCapture, __dvText, __dvLogText, __dvJson, DEFAULTS as __dvCaptureDefaults };
