import { create, all } from 'mathjs';
const math = create(all);
const node = math.parse('derivative("x^3 + 2x", "x")');
const transformed = node.transform(function (n) {
  if (n.isFunctionNode && n.fn.name === 'derivative') {
    return n.evaluate();
  }
  return n;
});
console.log(transformed.toString());
const compiled = transformed.compile();
console.log(compiled.evaluate({x: 3}));
