const { transform } = require('sucrase');
const jsCode = `
export function add(a, b) { return a + b; }
`;
console.log(transform(jsCode, { transforms: ['typescript', 'imports'] }).code);
