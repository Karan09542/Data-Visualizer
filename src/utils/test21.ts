import { parseSearchQuery } from './searchEngine.ts';
console.log(parseSearchQuery('features[].om > 20').ast);
console.log(parseSearchQuery('features.om > 20').ast);
console.log(parseSearchQuery('features[].om').ast);
console.log(parseSearchQuery('features.om').ast);
