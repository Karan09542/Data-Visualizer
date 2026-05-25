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

function testQ(q: string) {
    const p4 = parseSearchQuery(q);
    const matches = new Set<string>();
    const checkNode = (node: any, currentAncestors: string[], depth: number): boolean => {
      let isMatch = false;
      let handledMatches = false;
      if (p4.ast) {
         const context = buildSearchContext(node, depth);
         context.mode = 'permissive';
         const evalRes = evaluateQuery(p4.ast, context);
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
      if (isMatch && !handledMatches) matches.add(node.id);
      return isMatch;
    };
    checkNode(tree, [], 0);
    return Array.from(matches).sort();
}

console.log("Q1:", testQ("features.om = 10"));
console.log("Q2:", testQ("features[].om = 10"));
console.log("Q3:", testQ("features.om > -1"));
console.log("Q4:", testQ("features[].om > -1"));
