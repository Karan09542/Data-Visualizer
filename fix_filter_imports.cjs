const fs = require('fs');
let code = fs.readFileSync('src/components/image-workspace/components/panels/FilterStudioTab.tsx', 'utf8');

code = code.replace(/import \{([^}]+)\} from 'lucide-react';/, (match, p1) => {
    let icons = p1.split(',').map(s => s.trim());
    const needed = ['Bookmark', 'Power', 'ChevronUp', 'ChevronDown'];
    needed.forEach(n => {
        if (!icons.includes(n)) icons.push(n);
    });
    return `import { \n  ${icons.join(', ')}\n} from 'lucide-react';`;
});

code = code.replace(/..\/..\/..\/contexts/g, '../../contexts');
code = code.replace(/..\/..\/..\/commands/g, '../../commands');
code = code.replace(/..\/..\/..\/types/g, '../../types');

const colorPickerImport = "import { ColorPickerTrigger } from '../shared/ColorPickers';\n";
if (!code.includes('ColorPickerTrigger } from')) {
    code = code.replace("import { FilterSlider } from '../shared/FilterSlider';", "import { FilterSlider } from '../shared/FilterSlider';\n" + colorPickerImport);
}

fs.writeFileSync('src/components/image-workspace/components/panels/FilterStudioTab.tsx', code);
console.log("Fixed imports in FilterStudioTab.tsx");
