const { create, all } = require('mathjs');
const math = create(all);
try {
  console.log("With quotes:", math.parse('derivative("x^2", "x")').evaluate());
} catch(e) { console.log(e.message); }
try {
  console.log("Without quotes:", math.parse('derivative(x^2, x)').evaluate());
} catch(e) { console.log(e.message); }
