export type TreeNode = {
  id: string;
  name: string;
  type: string;
  value?: any;
  rawValue?: any;
  children?: TreeNode[];
  path: string;
};

export type ApiResponseView = 'auto' | 'nodes' | 'file';

/** Responses bigger than this many JSON entries show as a file in "auto" mode */
const AUTO_FILE_ENTRY_LIMIT = 150;

const MEDIA_RESPONSE_KEYS = ['_imageUrl', '_videoUrl', '_audioUrl', '_pdfUrl', '_modelUrl', '_blobSize', '_rawText'];

/** Whether an API response is media/text/binary rather than structured JSON */
export const isNonJsonApiResponse = (data: any) =>
  !!data && typeof data === 'object' && !Array.isArray(data) && MEDIA_RESPONSE_KEYS.some((key) => key in data);

/** Counts JSON entries, stopping as soon as the limit is passed */
const exceedsEntryLimit = (data: any, limit: number) => {
  let count = 0;
  const stack = [data];
  while (stack.length) {
    const value = stack.pop();
    if (value === null || typeof value !== 'object') continue;
    const children = Array.isArray(value) ? value : Object.values(value);
    count += children.length;
    if (count > limit) return true;
    for (const child of children) {
      if (child !== null && typeof child === 'object') stack.push(child);
    }
  }
  return false;
};

/** Decides how a fetched response is attached to its API node */
export const resolveApiResponseView = (data: any, view: ApiResponseView = 'auto'): 'nodes' | 'file' => {
  if (view === 'nodes' || view === 'file') return view;
  if (data === null || typeof data !== 'object') return 'nodes';
  if (isNonJsonApiResponse(data)) return 'file';
  return exceedsEntryLimit(data, AUTO_FILE_ENTRY_LIMIT) ? 'file' : 'nodes';
};

export const transformToTree = (
  data: any,
  name: string = 'root',
  path: string = 'root',
  apiNodeResponses?: Record<string, any>,
  jsNodeResponses?: Record<string, any>,
  jsNodeVisibility?: Record<string, { code: boolean, terminal: boolean }>,
  apiNodeConfig?: Record<string, { view?: ApiResponseView }>
): TreeNode => {
  const type = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;

  const node: TreeNode = { id: path, name, type, path, rawValue: data };

  let isApiNode = false;
  if (typeof name === 'string' && name.endsWith('_api_node') && type === 'string') {
    isApiNode = true;
  }

  let isJsNode = false;
  if (typeof name === 'string' && name.endsWith('_js_node') && type === 'string') {
    isJsNode = true;
  }

  let isTsNode = false;
  if (typeof name === 'string' && name.endsWith('_ts_node') && type === 'string') {
    isTsNode = true;
  }

  let isPyNode = false;
  if (typeof name === 'string' && name.endsWith('_py_node') && type === 'string') {
    isPyNode = true;
  }

  let isTodoNode = false;
  if (typeof name === 'string' && (name.endsWith('_todo_node') || name.endsWith('.todo'))) {
    isTodoNode = true;
  }

  if (isTodoNode) {
    node.value = data; // Keep raw data in value
    // Explicitly return to avoid rendering children (or set children = undefined)
    node.children = undefined;
    return node;
  }

  let isMathNode = false;
  if (typeof name === 'string' && (name.endsWith('_math_node') || name.endsWith('.math') || name.toLowerCase().endsWith('graph') || name.toLowerCase().endsWith('math'))) {
    isMathNode = true;
  }

  if (isMathNode) {
    node.value = data;
    node.children = undefined;
    return node;
  }

  if (type === 'object' && data !== null) {
    node.children = Object.entries(data).map(([key, val]) => {
      let safeKey = key;
      if (key.includes('.') || key.includes('[') || key.includes(']')) {
        safeKey = `["${key.replace(/"/g, '\\"')}"]`;
      } else {
        safeKey = `.${key}`;
      }
      return transformToTree(val, key, `${path}${safeKey}`, apiNodeResponses, jsNodeResponses, jsNodeVisibility, apiNodeConfig);
    });
  } else if (type === 'array') {
    node.children = data.map((val: any, index: number) =>
      transformToTree(val, `[${index}]`, `${path}[${index}]`, apiNodeResponses, jsNodeResponses, jsNodeVisibility, apiNodeConfig)
    );
  } else {
    // Aggressive truncation for massive strings to prevent memory & GC lags in D3/React
    if (type === 'string' && typeof data === 'string' && data.length > 50000) {
      const truncated = data.substring(0, 50000) + '\n\n... [TRUNCATED: Value exceeded 50KB to prevent memory lag]';
      node.value = truncated;
      node.rawValue = truncated; // Drop reference to the massive string
    } else {
      node.value = data;
    }

    // Inject fetched API response if available — either expanded into child nodes, or as a
    // single file-style node (large JSON, text, media and binary responses)
    if (isApiNode && apiNodeResponses && apiNodeResponses[path] !== undefined) {
      const fetchedData = apiNodeResponses[path];
      const view = resolveApiResponseView(fetchedData, apiNodeConfig?.[path]?.view);

      if (view === 'file') {
        node.children = [{
          id: `${path}.__response`,
          name: '__response',
          type: 'api_response',
          value: fetchedData,
          rawValue: fetchedData,
          path: `${path}.__response`,
        }];
      } else {
        const fetchedNode = transformToTree(fetchedData, '__fetched', `${path}.__fetched`, apiNodeResponses, jsNodeResponses, jsNodeVisibility, apiNodeConfig);
        node.children = [fetchedNode];
      }
    }

    // Inject JS tools and Output if available
    if (isJsNode) {
      node.children = [];
      return node;
      const visibility = jsNodeVisibility?.[path] || { code: true, terminal: true };

      if (visibility.code !== false) {
        node.children.push({
          id: `${path}.__js_code`,
          name: '__js_code',
          type: 'js_code',
          value: data,
          path: path,
          rawValue: data,
        });
      }

      if (visibility.terminal !== false) {
        node.children.push({
          id: `${path}.__js_terminal`,
          name: '__js_terminal',
          type: 'js_terminal',
          value: path,
          path: path,
          rawValue: null,
          children: []
        });
      }

      if (jsNodeResponses && jsNodeResponses[path] !== undefined) {
        const outputData = jsNodeResponses[path];
        const outputNode = transformToTree(outputData, '__output', `${path}.__output`, apiNodeResponses, jsNodeResponses, jsNodeVisibility, apiNodeConfig);

        let terminalNode = node.children.find(c => c.type === 'js_terminal');
        if (terminalNode) {
           terminalNode.children!.push(outputNode);
        } else {
           node.children.push(outputNode);
        }
      }
    }

    // Inject TS tools and Output if available
    if (isTsNode) {
      node.children = [];
      return node;
      const visibility = jsNodeVisibility?.[path] || { code: true, terminal: true };

      if (visibility.code !== false) {
        node.children.push({
          id: `${path}.__ts_code`,
          name: '__ts_code',
          type: 'ts_code',
          value: data,
          path: path,
          rawValue: data,
        });
      }

      if (visibility.terminal !== false) {
        node.children.push({
          id: `${path}.__ts_terminal`,
          name: '__ts_terminal',
          type: 'ts_terminal',
          value: path,
          path: path,
          rawValue: null,
          children: []
        });
      }

      if (jsNodeResponses && jsNodeResponses[path] !== undefined) {
        const outputData = jsNodeResponses[path];
        const outputNode = transformToTree(outputData, '__output', `${path}.__output`, apiNodeResponses, jsNodeResponses, jsNodeVisibility, apiNodeConfig);

        let terminalNode = node.children.find(c => c.type === 'ts_terminal');
        if (terminalNode) {
           terminalNode.children!.push(outputNode);
        } else {
           node.children.push(outputNode);
        }
      }
    }

    if (isPyNode) {
      node.children = [];
      return node;
      const visibility = jsNodeVisibility?.[path] || { code: true, terminal: true };

      if (visibility.code !== false) {
        node.children.push({
          id: `${path}.__py_code`,
          name: '__py_code',
          type: 'py_code',
          value: data,
          path: path,
          rawValue: data,
        });
      }

      if (visibility.terminal !== false) {
        node.children.push({
          id: `${path}.__py_terminal`,
          name: '__py_terminal',
          type: 'py_terminal',
          value: path,
          path: path,
          rawValue: null,
          children: []
        });
      }

      if (jsNodeResponses && jsNodeResponses[path] !== undefined) {
        const outputData = jsNodeResponses[path];
        const outputNode = transformToTree(outputData, '__output', `${path}.__output`, apiNodeResponses, jsNodeResponses, jsNodeVisibility, apiNodeConfig);

        let terminalNode = node.children.find(c => c.type === 'py_terminal');
        if (terminalNode) {
           terminalNode.children!.push(outputNode);
        } else {
           node.children.push(outputNode);
        }
      }
    }
  }

  return node;
};
