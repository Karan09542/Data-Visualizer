const { create, all } = require('mathjs');
const math = create(all);

const node = math.parse('derivative(x^3 + 2x, x)');

const transformNode = (n) => {
  let mapped = n.map(transformNode);
  if (mapped.isFunctionNode) {
    try {
      if (mapped.fn.name === "derivative") {
         const res = math.derivative(mapped.args[0], mapped.args[1]);
         if (res && (res.isNode || res.type)) {
           // mapped = res.map(transformNode);
           // Try just mapped = res
           mapped = res;
         }
      }
    } catch(e) {}
  }
  return mapped;
};

const t1 = transformNode(node);
console.log(t1.toString());
const c1 = t1.compile();
console.log(c1.evaluate({x: 3}));
