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
        {"om": 50}  // [5]
    ]
};
const tree = transformToTree(data);

const q3 = 'features.om > 20';
const p3 = parseSearchQuery(q3);

console.log("Q1 AST:", JSON.stringify(p3.ast));
const ctx1 = buildSearchContext(tree);
ctx1.mode = 'permissive';
console.log("Result Permissive:", JSON.stringify(evaluateQuery(p3.ast, ctx1)));

const q4 = 'features[].om > 20';
const p4 = parseSearchQuery(q4);
const ctx2 = buildSearchContext(tree);
ctx2.mode = 'permissive';
console.log("Result Permissive [].om :", JSON.stringify(evaluateQuery(p4.ast, ctx2)));


