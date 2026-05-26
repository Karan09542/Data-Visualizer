import { tokenize, parseSearchQuery } from './src/utils/searchEngine.ts';
console.dir(tokenize('/media|/i IN name/="^fea"'), { depth: null });
console.dir(parseSearchQuery('/media|/i IN name/="^fea"'), { depth: null });
console.dir(tokenize('/media|\\d/i IN name/="^fea"'), { depth: null });
console.dir(parseSearchQuery('/media|\\d/i IN name/="^fea"'), { depth: null });
