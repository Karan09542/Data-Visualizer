import { parseSearchQuery } from './searchEngine.ts';
console.log(parseSearchQuery('features[].om=10').ast);
console.log(parseSearchQuery('features.om=10').ast);
