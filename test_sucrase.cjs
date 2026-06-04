const { transform } = require('sucrase');
const code1 = `
export function add(a, b) { return a + b; }
`;
const code2 = `
import { add } from "./utils.ts";
console.log(add(1,2));
`;
console.log(transform(code1, { transforms: ['typescript', 'imports'] }).code);
console.log('---');
console.log(transform(code2, { transforms: ['typescript', 'imports'] }).code);
