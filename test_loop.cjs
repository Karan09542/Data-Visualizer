const math = require("mathjs");
try {
  let res = math.evaluate("map(1:5, f(i)=i^2)");
  console.log("map result:", res);
  
  let res2 = math.evaluate("forEach(1:5, f(i)=i^2)");
  console.log("forEach result:", res2);
} catch (e) {
  console.error(e.message);
}
