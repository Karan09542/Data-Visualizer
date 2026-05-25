import { parseSearchQuery, evaluateQuery, buildSearchContext } from './searchEngine.ts';
import { transformToTree } from './transformer.ts';
const data = {
    "features": [
        {"om": 0},
        {"om": 10},
        {"om": 30}
    ]
};
const tree = transformToTree(data);

const queries = ['features.om', 'features[].om', 'features.om > 15', 'features[].om > 15'];

queries.forEach(q => {
    const parsed = parseSearchQuery(q);
    const matches = new Set<string>();

    const checkNode = (node: any, currentAncestors: string[], depth: number): boolean => {
      let isMatch = false;
      let handledMatches = false;
      if (parsed.ast) {
         const context = buildSearchContext(node, depth);
         context.mode = 'permissive';
         const evalRes = evaluateQuery(parsed.ast, context);
         isMatch = evalRes.isMatch;
         if (isMatch && evalRes.matchedPaths && evalRes.matchedPaths.length > 0) {
             handledMatches = true;
             for (const p of evalRes.matchedPaths) {
                 matches.add(p);
                 // ... extract parts and add to matches/ancestors ...
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
    console.log(`Query "${q}" matches:`, Array.from(matches));
});

