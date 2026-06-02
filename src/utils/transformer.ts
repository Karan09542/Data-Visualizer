export type TreeNode = {
  id: string;
  name: string;
  type: string;
  value?: any;
  rawValue?: any;
  children?: TreeNode[];
  path: string;
};

export const transformToTree = (
  data: any, 
  name: string = 'root', 
  path: string = 'root', 
  apiNodeResponses?: Record<string, any>,
  jsNodeResponses?: Record<string, any>,
  jsNodeVisibility?: Record<string, { code: boolean, terminal: boolean }>
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

  if (type === 'object' && data !== null) {
    node.children = Object.entries(data).map(([key, val]) => 
      transformToTree(val, key, `${path}.${key}`, apiNodeResponses, jsNodeResponses, jsNodeVisibility)
    );
  } else if (type === 'array') {
    node.children = data.map((val: any, index: number) => 
      transformToTree(val, `[${index}]`, `${path}[${index}]`, apiNodeResponses, jsNodeResponses, jsNodeVisibility)
    );
  } else {
    node.value = data;
    
    // Inject fetched API response if available
    if (isApiNode && apiNodeResponses && apiNodeResponses[path] !== undefined) {
      const fetchedData = apiNodeResponses[path];
      const fetchedNode = transformToTree(fetchedData, '__fetched', `${path}.__fetched`, apiNodeResponses, jsNodeResponses, jsNodeVisibility);
      node.children = [fetchedNode];
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
        const outputNode = transformToTree(outputData, '__output', `${path}.__output`, apiNodeResponses, jsNodeResponses, jsNodeVisibility);
        
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
        const outputNode = transformToTree(outputData, '__output', `${path}.__output`, apiNodeResponses, jsNodeResponses, jsNodeVisibility);
        
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
        const outputNode = transformToTree(outputData, '__output', `${path}.__output`, apiNodeResponses, jsNodeResponses, jsNodeVisibility);
        
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
