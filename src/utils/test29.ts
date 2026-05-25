import { parseSearchQuery, evaluateQuery, buildSearchContext } from './searchEngine.ts';
import { transformToTree } from './transformer.ts';
const data = {
    "project": "JSON Graph Viewer",
    "features": [
        "Many Theme Options",
        "Different Edges Style",
        {"om": 0},
        {"om": 10},
        {"om": 20}
    ]
};
const tree = transformToTree(data);
const p2 = parseSearchQuery('features[].om > 15');
const ctxStrict = buildSearchContext(tree); ctxStrict.mode = 'strict';
console.log("Q2 Result Strict:", evaluateQuery(p2.ast, ctxStrict));
