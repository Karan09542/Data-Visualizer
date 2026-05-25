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
        {"om": 20}
    ]
};
const tree = transformToTree(data);

const q1 = 'features.om > 20';
const q2 = 'features[].om > 20';

const p1 = parseSearchQuery(q1);
const p2 = parseSearchQuery(q2);

console.log("Q1 AST:", JSON.stringify(p1.ast));
console.log("Q2 AST:", JSON.stringify(p2.ast));

const ctxStrict = buildSearchContext(tree);
ctxStrict.mode = 'strict';
console.log("Q2 Result Strict:", evaluateQuery(p2.ast, ctxStrict));
