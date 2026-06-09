const args = ["Encountered two children with the same key, `%s`. Keys should be unique.", "duplicate-key-123"];
const cleanArgs = args.map(arg => String(arg));
console.log(cleanArgs.join(' '));
