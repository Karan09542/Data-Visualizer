const { transform } = require('sucrase');

const vfs = {
    '/utils.js': 'function add(a, b) { return a + b; }',
    '/index.ts': 'import { add } from "./utils.ts";\nconsole.log("RESULT:", add(1, 2));'
};

const compiledVfs = {};
for (const [vPath, vCode] of Object.entries(vfs)) {
    compiledVfs[vPath] = transform(vCode, { transforms: ['typescript', 'imports'] }).code;
}

const workerCode = `
const vfsData = ${JSON.stringify(compiledVfs)};
const __modules__ = {};

function customRequire(request, currentPath) {
    if (request === '/index.ts') request = './index.ts';
    const parts = currentPath.substring(0, currentPath.lastIndexOf('/')).split('/').filter(Boolean);
    for (const part of request.split('/')) {
        if (part === '.') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
    }
    let resolved = '/' + parts.join('/');
    
    let targetPaths = [];
    let baseResolved = resolved;
    if (resolved.endsWith('.js') || resolved.endsWith('.ts')) {
        baseResolved = resolved.substring(0, resolved.lastIndexOf('.'));
    }
    
    targetPaths.push(baseResolved + '.ts');
    targetPaths.push(baseResolved + '.js');
    targetPaths.push(baseResolved);
    targetPaths.push(resolved + '.ts');
    targetPaths.push(resolved + '.js');
    
    let finalResolved = null;
    for (const p of targetPaths) {
        if (vfsData[p] !== undefined) {
            finalResolved = p;
            break;
        }
    }
    if (finalResolved !== null) resolved = finalResolved;
    
    if (!vfsData[resolved]) throw new Error("Cannot resolve module " + request + " from " + currentPath);
    
    if (__modules__[resolved]) return __modules__[resolved].exports;
    
    const module = { exports: {} };
    __modules__[resolved] = module;
    
    const localRequire = (req) => customRequire(req, resolved);
    const wrapper = new Function('require', 'exports', 'module', 'console', 'input', vfsData[resolved]);
    wrapper(localRequire, module.exports, module, console, undefined);
    return module.exports;
}

try {
    customRequire('./index.ts', '/main.ts');
} catch (e) {
    console.error(e.message);
}
`;

require('fs').writeFileSync('./test_tsExecutor_sim.cjs', workerCode);
