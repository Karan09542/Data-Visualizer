export type TreeNode = {
  id: string;
  name: string;
  type: string;
  value?: any;
  rawValue?: any;
  children?: TreeNode[];
  path: string;
};

export const transformToTree = (data: any, name: string = 'root', path: string = 'root'): TreeNode => {
  const type = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
  
  const node: TreeNode = { id: path, name, type, path, rawValue: data };
  
  if (type === 'object' && data !== null) {
    node.children = Object.entries(data).map(([key, val]) => 
      transformToTree(val, key, `${path}.${key}`)
    );
  } else if (type === 'array') {
    node.children = data.map((val: any, index: number) => 
      transformToTree(val, `[${index}]`, `${path}[${index}]`)
    );
  } else {
    node.value = data;
  }
  
  return node;
};
