/**
 * A logged value, shown the way a terminal shows it: a one-line preview that opens into its
 * contents. Objects, arrays, Maps and Sets expand; everything else is a single coloured token.
 *
 * Values arrive already captured from the worker (see utils/consoleValue.js) so that class names,
 * functions and symbols survive the trip; anything else - Python output, older logs - is captured
 * here. Only what is open is rendered, and long arrays open in blocks, so a huge value costs
 * nothing until it is looked at.
 */
import React, { memo, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
// @ts-ignore - plain JavaScript, shared with the worker
import {
  __dvCapture as captureValue,
  __dvIsCapture as isCapture,
  __dvText as textOf,
  __dvLogText as logTextOf,
} from "../../utils/consoleValue.js";

/** How many items an open array shows at once before splitting into blocks. */
const BLOCK = 100;
/** How many properties an open object shows before offering the rest. */
const FIRST_PROPERTIES = 100;
/** Entries shown inside a collapsed preview. */
const PREVIEW_ENTRIES = 5;

const tone = {
  key: "text-sky-700 dark:text-[#9cdcfe]",
  string: "text-orange-700 dark:text-[#ce9178]",
  number: "text-emerald-700 dark:text-[#b5cea8]",
  keyword: "text-blue-700 dark:text-[#569cd6]",
  muted: "text-slate-500 dark:text-slate-400",
  ctor: "text-teal-700 dark:text-[#4ec9b0]",
  fn: "italic text-yellow-700 dark:text-[#dcdcaa]",
  symbol: "text-amber-700 dark:text-[#d7ba7d]",
  element: "text-rose-700 dark:text-[#d16969]",
  error: "text-red-600 dark:text-red-400",
};

type Node = any;

const isNode = (value: Node) => isCapture(value);

const nodeType = (value: Node): string => {
  if (isNode(value)) return value.t;
  if (value === null) return "null";
  return typeof value;
};

const EXPANDS = new Set(["object", "array", "map", "set", "error"]);

const expandable = (value: Node) => {
  const type = nodeType(value);
  if (!EXPANDS.has(type)) return false;
  if (type === "object") return value.entries.length > 0 || value.more > 0;
  if (type === "array") return value.items.length > 0 || value.more > 0;
  if (type === "map" || type === "set") return value.size > 0;
  return true; // an error always has a stack worth opening
};

const functionLabel = (node: Node) =>
  node.kind === "class" ? `[class ${node.name || "(anonymous)"}]` : `[Function: ${node.name || "(anonymous)"}]`;

/** The short form: what the value is, in one line. */
function Token({ node, top = false }: { node: Node; top?: boolean }) {
  if (!isNode(node)) {
    if (typeof node === "string") {
      return top ? (
        <span className="whitespace-pre-wrap break-all">{node}</span>
      ) : (
        <span className={tone.string}>'{node}'</span>
      );
    }
    if (typeof node === "number") return <span className={tone.number}>{String(node)}</span>;
    if (typeof node === "boolean") return <span className={tone.keyword}>{String(node)}</span>;
    if (node === null) return <span className={tone.keyword}>null</span>;
    return <span className={tone.muted}>{String(node)}</span>;
  }

  switch (node.t) {
    case "undefined":
      return <span className={tone.muted}>undefined</span>;
    case "number":
    case "bigint":
      return <span className={tone.number}>{node.text}</span>;
    case "string":
      return top ? (
        <span className="whitespace-pre-wrap break-all">
          {node.text}
          <span className={tone.muted}>… {node.length - node.text.length} more characters</span>
        </span>
      ) : (
        <span className={tone.string}>
          '{node.text}'<span className={tone.muted}>… {node.length - node.text.length} more</span>
        </span>
      );
    case "symbol":
      return <span className={tone.symbol}>{node.text}</span>;
    case "function":
      return <span className={tone.fn}>{functionLabel(node)}</span>;
    case "date":
      return <span className={tone.ctor}>{node.iso}</span>;
    case "regexp":
    case "element":
      return <span className={tone.element}>{node.text}</span>;
    case "promise":
      return <span className={tone.ctor}>Promise</span>;
    case "circular":
      return <span className={tone.muted}>[Circular]</span>;
    case "unreadable":
      return <span className={tone.muted}>[Unreadable]</span>;
    case "cut":
      return (
        <span className={tone.muted}>{node.reason === "depth" ? `[${node.label}]` : "[Too large to capture]"}</span>
      );
    case "error":
      return (
        <span className={tone.error}>
          {node.name}: {node.message}
        </span>
      );
    default:
      return <Preview node={node} />;
  }
}

/** `ZodObject {a: 1, b: 'x', …}` - what a collapsed value looks like. */
function Preview({ node }: { node: Node }) {
  if (!isNode(node) || !EXPANDS.has(node.t)) return <Token node={node} />;

  if (node.t === "array") {
    const shown = node.items.slice(0, PREVIEW_ENTRIES);
    return (
      <span>
        {node.ctor && <span className={tone.ctor}>{node.ctor} </span>}
        <span className={tone.muted}>({node.len}) [</span>
        {shown.map((item: Node, i: number) => (
          <span key={i}>
            {i > 0 && <span className={tone.muted}>, </span>}
            <Token node={item} />
          </span>
        ))}
        {node.len > shown.length && <span className={tone.muted}>{shown.length ? ", …" : "…"}</span>}
        <span className={tone.muted}>]</span>
      </span>
    );
  }

  if (node.t === "object") {
    const shown = node.entries.slice(0, PREVIEW_ENTRIES);
    return (
      <span>
        {node.ctor && <span className={tone.ctor}>{node.ctor} </span>}
        <span className={tone.muted}>{"{"}</span>
        {shown.map(([key, value]: [string, Node], i: number) => (
          <span key={key}>
            {i > 0 && <span className={tone.muted}>, </span>}
            <span className={tone.key}>{key}</span>
            <span className={tone.muted}>: </span>
            <Token node={value} />
          </span>
        ))}
        {(node.entries.length > shown.length || node.more > 0) && (
          <span className={tone.muted}>{shown.length ? ", …" : "…"}</span>
        )}
        <span className={tone.muted}>{"}"}</span>
      </span>
    );
  }

  if (node.t === "map" || node.t === "set") {
    return (
      <span>
        <span className={tone.ctor}>
          {node.t === "map" ? "Map" : "Set"}({node.size})
        </span>
        <span className={tone.muted}> {"{…}"}</span>
      </span>
    );
  }

  return <Token node={node} />;
}

const Row: React.FC<{ label?: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start gap-1.5 leading-[1.35]">
    {label !== undefined && <span className="shrink-0">{label}</span>}
    <span className="min-w-0">{children}</span>
  </div>
);

/** The contents of an open value, one level deep. */
function Children({ node }: { node: Node }) {
  if (node.t === "object") return <ObjectChildren node={node} />;

  if (node.t === "array") {
    // Long arrays open in blocks, the way a browser console does.
    if (node.items.length > BLOCK) {
      const blocks = [];
      for (let start = 0; start < node.items.length; start += BLOCK) {
        const end = Math.min(start + BLOCK - 1, node.items.length - 1);
        blocks.push(
          <Expandable
            key={start}
            header={
              <span className={tone.muted}>
                [{start} … {end}]
              </span>
            }
            body={
              <>
                {node.items.slice(start, end + 1).map((item: Node, i: number) => (
                  <Row key={start + i} label={<span className={tone.muted}>{start + i}:</span>}>
                    <ConsoleValue value={item} />
                  </Row>
                ))}
              </>
            }
          />,
        );
      }
      return (
        <>
          {blocks}
          {node.more > 0 && <div className={`${tone.muted} italic`}>… {node.more} more items</div>}
        </>
      );
    }
    return (
      <>
        {node.items.map((item: Node, i: number) => (
          <Row key={i} label={<span className={tone.muted}>{i}:</span>}>
            <ConsoleValue value={item} />
          </Row>
        ))}
        {node.more > 0 && <div className={`${tone.muted} italic`}>… {node.more} more items</div>}
      </>
    );
  }

  if (node.t === "map") {
    return (
      <>
        {node.entries.map(([key, value]: [Node, Node], i: number) => (
          <Row key={i} label={<span className={tone.muted}>{i}:</span>}>
            <span className="inline-flex items-start gap-1">
              <ConsoleValue value={key} />
              <span className={tone.muted}>{"=>"}</span>
              <ConsoleValue value={value} />
            </span>
          </Row>
        ))}
        {node.more > 0 && <div className={`${tone.muted} italic`}>… {node.more} more entries</div>}
      </>
    );
  }

  if (node.t === "set") {
    return (
      <>
        {node.items.map((item: Node, i: number) => (
          <Row key={i} label={<span className={tone.muted}>{i}:</span>}>
            <ConsoleValue value={item} />
          </Row>
        ))}
        {node.more > 0 && <div className={`${tone.muted} italic`}>… {node.more} more entries</div>}
      </>
    );
  }

  if (node.t === "error") {
    return (
      <pre className={`${tone.error} whitespace-pre-wrap break-all text-[11px] leading-[1.35]`}>
        {node.stack || `${node.name}: ${node.message}`}
      </pre>
    );
  }

  return null;
}

/** An open object: the first properties, and the rest only if asked for. */
function ObjectChildren({ node }: { node: Node }) {
  const [showAll, setShowAll] = useState(node.entries.length <= FIRST_PROPERTIES);
  const shown = showAll ? node.entries : node.entries.slice(0, FIRST_PROPERTIES);
  return (
    <>
      {shown.map(([key, value]: [string, Node]) => (
        <Row
          key={key}
          label={
            <>
              <span className={tone.key}>{key}</span>
              <span className={tone.muted}>:</span>
            </>
          }
        >
          <ConsoleValue value={value} />
        </Row>
      ))}
      {!showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`${tone.muted} italic hover:underline underline-offset-2 cursor-pointer`}
        >
          Show {node.entries.length - shown.length} more properties
        </button>
      )}
      {node.more > 0 && <div className={`${tone.muted} italic`}>… {node.more} more properties (not captured)</div>}
    </>
  );
}

/** A triangle, a one-line summary, and the contents once opened. */
const Expandable: React.FC<{ header: React.ReactNode; body: React.ReactNode; defaultExpanded?: boolean }> = ({
  header,
  body,
  defaultExpanded = false,
}) => {
  const [open, setOpen] = useState(defaultExpanded);
  return (
    <span className="inline-block align-top w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-start gap-0.5 text-left hover:bg-slate-100 dark:hover:bg-white/5 rounded-[3px] px-0.5 -mx-0.5 cursor-pointer"
        aria-expanded={open}
      >
        <span className="mt-[2px] shrink-0 text-slate-400">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <span className="min-w-0">{header}</span>
      </button>
      {open && <div className="pl-3 ml-[5px] border-l border-slate-200 dark:border-white/10 mt-0.5">{body}</div>}
    </span>
  );
};

export interface ConsoleValueProps {
  value: any;
  /** Errors and the like can start open. */
  defaultExpanded?: boolean;
  /** A string logged on its own prints as text, not quoted. */
  top?: boolean;
}

export const ConsoleValue = memo(function ConsoleValue({
  value,
  defaultExpanded = false,
  top = false,
}: ConsoleValueProps) {
  const node = useMemo(() => (isNode(value) ? value : captureValue(value)), [value]);
  if (!expandable(node)) return <Token node={node} top={top} />;
  return (
    <Expandable header={<Preview node={node} />} body={<Children node={node} />} defaultExpanded={defaultExpanded} />
  );
});

/** The same value as plain text, for copying. Kept with the capture, so both agree. */
export const consoleValueToText = (value: any, depth = 0): string => textOf(value, depth);

/** The text of a whole log line, for copy buttons. */
export const logArgsToText = (args: any[]): string => logTextOf(args);
