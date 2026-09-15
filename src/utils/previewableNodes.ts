/**
 * Text nodes the preview popup can move between and search.
 *
 * A previewable text node is a non-empty string value that opens as text: special nodes (API, JS,
 * TS, Python, todo, transfer, math, search, image) and media values are left out, matching what the
 * canvas and the node context menu treat as something other than text. Paths use the same format as
 * `transformToTree`, so they match the path the popup was opened with and `updateNodeValue` accepts them.
 */
import { detectMediaFile } from './mediaFiles';

export type PreviewableKind = 'markdown' | 'html' | 'text';

export interface PreviewableNode {
  /** `root.key`, `root["a.b"]`, `root.list[0]` */
  path: string;
  /** The key, or `[index]` for array items */
  name: string;
  parentPath: string;
  value: string;
  kind: PreviewableKind;
}

export interface PreviewableNodeMatch {
  node: PreviewableNode;
  /** Surrounding text of a content match, flattened to one line; null when only the name/path matched */
  snippet: string | null;
}

/** Results shown at once in the node switcher */
export const NODE_SEARCH_LIMIT = 100;

/** Upper bound on indexed nodes, so a huge workspace can't stall the popup */
const MAX_NODES = 5000;

export const looksLikeHtml = (text: string) => {
  const val = text.toLowerCase().trim();
  return (
    val.startsWith('<html') ||
    val.startsWith('<!doc') ||
    val.includes('<head>') ||
    val.includes('<body>') ||
    val.includes('</div>') ||
    val.includes('</p>') ||
    val.includes('</a>')
  );
};

const looksLikeMarkdown = (name: string, text: string) =>
  /\.(md|markdown|mdx)$/i.test(name) ||
  /(^|\n)#{1,6}\s|```|(^|\n)\s*[-*+]\s|\[[^\]\n]+\]\([^)\n]+\)|\*\*[^*\n]+\*\*/.test(text);

const SPECIAL_SUFFIXES = [
  '_api_node', '_js_node', '_ts_node', '_py_node', '_image_node',
  '_todo_node', '.todo', '_transfer_node', '.transfer', '_math_node', '.math', '_search_node', '.search',
];

/** Mirrors transformer.ts / NodeRenderer.tsx: keys that render as special nodes rather than text */
export const isSpecialNodeName = (name: string) => {
  const lower = name.toLowerCase();
  return SPECIAL_SUFFIXES.some((suffix) => name.endsWith(suffix)) || lower.endsWith('graph') || lower.endsWith('math');
};

// Same key escaping as transformToTree
const childPath = (parentPath: string, key: string) =>
  key.includes('.') || key.includes('[') || key.includes(']')
    ? `${parentPath}["${key.replace(/"/g, '\\"')}"]`
    : `${parentPath}.${key}`;

/** Every previewable text node in document order */
export function collectPreviewableNodes(
  data: unknown,
  mimeTypes?: Record<string, { mimeType?: string } | undefined>,
): PreviewableNode[] {
  const nodes: PreviewableNode[] = [];

  const visit = (value: unknown, name: string, path: string, parentPath: string) => {
    if (nodes.length >= MAX_NODES) return;
    // Special nodes are skipped together with everything inside them
    if (isSpecialNodeName(name)) return;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (detectMediaFile(name, value, mimeTypes)) return;
      // A bare link opens as media / an embed, not as text
      if (/^https?:\/\/\S+$/i.test(trimmed)) return;
      nodes.push({
        path,
        name,
        parentPath,
        value,
        kind: looksLikeHtml(value) ? 'html' : looksLikeMarkdown(name, value) ? 'markdown' : 'text',
      });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `[${index}]`, `${path}[${index}]`, path));
      return;
    }

    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        visit(item, key, childPath(path, key), path);
      }
    }
  };

  visit(data, 'root', 'root', '');
  return nodes;
}

const snippetAround = (text: string, at: number, length: number) => {
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + length + 80);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`;
};

/**
 * Case-insensitive search over name, path and content. Name/path matches come before content-only
 * matches; each group keeps document order. An empty query lists nodes in document order.
 */
export function searchPreviewableNodes(
  nodes: PreviewableNode[],
  query: string,
  limit = NODE_SEARCH_LIMIT,
): PreviewableNodeMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes.slice(0, limit).map((node) => ({ node, snippet: null }));

  const byName: PreviewableNodeMatch[] = [];
  const byContent: PreviewableNodeMatch[] = [];

  for (const node of nodes) {
    const inName = node.name.toLowerCase().includes(needle) || node.path.toLowerCase().includes(needle);
    const at = node.value.toLowerCase().indexOf(needle);
    if (!inName && at === -1) continue;

    const match = { node, snippet: at === -1 ? null : snippetAround(node.value, at, needle.length) };
    if (inName) byName.push(match);
    else byContent.push(match);

    if (byName.length >= limit) break;
  }

  return [...byName, ...byContent].slice(0, limit);
}
