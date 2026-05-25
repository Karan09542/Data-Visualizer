import { parseSearchQuery, evaluateQuery, buildSearchContext } from './searchEngine.ts';
import { transformToTree } from './transformer.ts';
const data = {
    "project": "JSON Graph Viewer",
    "features": [
        {"om": 0}, 
        {"om": 10}, 
        {"om": 20},
        {"om": 60}
    ]
};
const tree = transformToTree(data);

const q3 = 'features.om > 50';
const q4 = 'features[].om > 50';

const p3 = parseSearchQuery(q3);
const p4 = parseSearchQuery(q4);

const ctx1 = buildSearchContext(tree); ctx1.mode = 'permissive';
const ctx2 = buildSearchContext(tree); ctx2.mode = 'permissive';

console.log("Q1 Permissive:", evaluateQuery(p3.ast, ctx1).matchedPaths);
console.log("Q2 Permissive:", evaluateQuery(p4.ast, ctx2).matchedPaths);
