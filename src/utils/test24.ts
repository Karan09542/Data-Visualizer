import { parseSearchQuery, evaluateQuery, buildSearchContext } from './searchEngine.ts';
import { transformToTree } from './transformer.ts';
const data = {
    "project": "JSON Graph Viewer",
    "features": [
        {"om": 0}, 
        {"om": 10}, 
        {"om": 20}  
    ]
};
const tree = transformToTree(data);
const p4 = parseSearchQuery('features[].om = 10');
const matches = new Set<string>();
const checkNode = (node: any, currentAncestors: string[], depth: number): boolean => {
  let isMatch = false;
  if (p4.ast) {
     const context = buildSearchContext(node, depth);
     context.mode = 'permissive';
     const evalRes = evaluateQuery(p4.ast, context);
     isMatch = evalRes.isMatch;
     if (isMatch && evalRes.matchedPaths && evalRes.matchedPaths.length > 0) {
         for (const p of evalRes.matchedPaths) matches.add(p);
     }
  }
  if (node.children) {
     for (const child of node.children) {
        checkNode(child, [...currentAncestors, node.id], depth + 1);
     }
  }
  return isMatch;
};
checkNode(tree, [], 0);
console.log("Matches:", Array.from(matches));
