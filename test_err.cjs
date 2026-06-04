const { transform } = require('sucrase');
const py = `
function customRequire(request) {
    if (request === './utils.ts') return {}; // SIMULATE IT RETURNING EMPTY OBJECT
    return {};
}
var _utilsts = customRequire('./utils.ts');
try {
    _utilsts.add.call(void 0, 1, 2);
} catch (e) {
    console.log(e.message);
}
`;
console.log(py);
