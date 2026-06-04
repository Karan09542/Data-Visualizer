const { transform } = require('sucrase');
console.log(transform(`import { add } from "./utils.js"\nconsole.log(add(1,2))`, { transforms: ['typescript', 'imports'] }).code);
console.log('---');
console.log(transform(`import { add } from "./utils.ts"\nconsole.log(add(1,2))`, { transforms: ['typescript', 'imports'] }).code);
