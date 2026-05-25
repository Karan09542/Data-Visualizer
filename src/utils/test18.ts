import { parseSearchQuery, evaluateQuery, buildSearchContext } from './searchEngine.ts';
import { transformToTree } from './transformer.ts';
const data = {
    "project": "JSON Graph Viewer",
    "version": "1.0.0",
    "features": [
        "Many Theme Options",
        "Different Edges Style", 
        "Media Preview", 
        {"om": 0}, 
        {"om": 10}, 
        {"om": 50}  
    ]
};
const tree = transformToTree(data);

const q4 = 'features[].om';
const p4 = parseSearchQuery(q4);
const ctx2 = buildSearchContext(tree);
ctx2.mode = 'permissive';
console.log("Result AST:", p4.ast);
console.log("Result evaluate:", evaluateQuery(p4.ast, ctx2));

