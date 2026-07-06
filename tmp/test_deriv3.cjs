const { create, all } = require('mathjs');
const math = create(all);
const node = math.parse('derivative(x^3 + 2x, x)');
console.log(node.args[0].type); // OperatorNode?
console.log(node.args[1].type); // SymbolNode?

try {
  const res = math.derivative(node.args[0], node.args[1]);
  console.log(res.toString());
} catch(e) { console.log(e.message); }
