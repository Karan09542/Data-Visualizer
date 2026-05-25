import { parseSearchQuery, evaluateQuery, buildSearchContext } from './searchEngine.ts';
import { transformToTree } from './transformer.ts';
const data = {
    "project": "JSON Graph Viewer",
    "version": "1.0.0",
    "features": [
        "Many Theme Options",
        "Different Edges Style", // [1]
        "Media Preview", // [2]
        {"om": 0}, // [3]
        {"om": 10}, // [4]
        {"om": 20}  // [5]
    ]
};
const tree = transformToTree(data);

const q3 = 'features[].om > -1';
const p3 = parseSearchQuery(q3);

const matches = new Set<string>();

const checkNode = (node: any, currentAncestors: string[], depth: number): boolean => {
  let isMatch = false;
  let handledMatches = false;
  
  if (p3.ast) {
     const context = buildSearchContext(node, depth);
     context.mode = 'permissive';
     const evalRes = evaluateQuery(p3.ast, context);
     isMatch = evalRes.isMatch;
     
     if (isMatch && evalRes.matchedPaths && evalRes.matchedPaths.length > 0) {
         handledMatches = true;
         for (const p of evalRes.matchedPaths) {
             matches.add(p);
             const parts = p.match(/root|\[\d+\]|[^.\[]+/g) || [];
             let temp = '';
             for (let i = 0; i < parts.length; i++) {
                 let part = parts[i];
                 if (i > 0 && part !== 'root' && !part.startsWith('[')) {
                     temp += '.' + part;
                 } else {
                     temp += part;
                 }
                 matches.add(temp);
             }
         }
         matches.add(node.id);
     }
  }
  
  if (node.children) {
     for (const child of node.children) {
        checkNode(child, [...currentAncestors, node.id], depth + 1);
     }
  }
  
  if (isMatch && !handledMatches) {
     matches.add(node.id);
  }
  return isMatch;
};

checkNode(tree, [], 0);

console.log("Matches:", Array.from(matches));

