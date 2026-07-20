const fs = require('fs');
let code = fs.readFileSync('src/components/image-workspace/components/panels/FilterStudioTab.tsx', 'utf8');

code = code.replace("{activeTab === 'filters' && (", "");

const lastBraceIndex = code.lastIndexOf(')}');
if (lastBraceIndex !== -1) {
    code = code.substring(0, lastBraceIndex) + code.substring(lastBraceIndex + 2);
}

fs.writeFileSync('src/components/image-workspace/components/panels/FilterStudioTab.tsx', code);
console.log("Stripped activeTab wrapper");
