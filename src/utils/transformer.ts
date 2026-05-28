export type TreeNode = {
  id: string;
  name: string;
  type: string;
  value?: any;
  rawValue?: any;
  children?: TreeNode[];
  path: string;
};

export const transformToTree = (data: any, name: string = 'root', path: string = 'root', apiNodeResponses?: Record<string, any>): TreeNode => {
  const type = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
  
  const node: TreeNode = { id: path, name, type, path, rawValue: data };
  
  let isApiNode = false;
  if (typeof name === 'string' && name.endsWith('_api_node') && type === 'string') {
    isApiNode = true;
  }

  if (type === 'object' && data !== null) {
    node.children = Object.entries(data).map(([key, val]) => 
      transformToTree(val, key, `${path}.${key}`, apiNodeResponses)
    );
  } else if (type === 'array') {
    node.children = data.map((val: any, index: number) => 
      transformToTree(val, `[${index}]`, `${path}[${index}]`, apiNodeResponses)
    );
  } else {
    node.value = data;
    
    // Inject fetched API response if available
    if (isApiNode && apiNodeResponses && apiNodeResponses[path] !== undefined) {
      const fetchedData = apiNodeResponses[path];
      const fetchedNode = transformToTree(fetchedData, '__fetched', `${path}.__fetched`, apiNodeResponses);
      node.children = [fetchedNode];
    }
  }
  
  return node;
};
