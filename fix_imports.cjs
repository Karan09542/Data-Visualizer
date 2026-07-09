const fs = require('fs');
let code = fs.readFileSync('src/components/image-workspace/ImageWorkspace.tsx', 'utf8');

// Fix external imports by prepending '../'
code = code.replace(/import (.*?) from "\.\.\/([^"]+)";/g, 'import $1 from "../../$2";');

// Fix internal imports that were referencing things in `src/components` directly (e.g. `./export/ExportStudio`)
// Now they should be `../export/ExportStudio` since we moved to `src/components/image-workspace/`
code = code.replace(/import (.*?) from "\.\/export\/([^"]+)";/g, 'import $1 from "../export/$2";');
code = code.replace(/import (.*?) from "\.\/image-import\/([^"]+)";/g, 'import $1 from "../image-import/$2";');
code = code.replace(/import (.*?) from "\.\/FontPicker";/g, 'import $1 from "../FontPicker";');
code = code.replace(/import (.*?) from "\.\/TypographyPresets";/g, 'import $1 from "../TypographyPresets";');

// Fix the extracted file imports: earlier we injected `./image-workspace/...`
// Now we are inside `image-workspace`, so it should be `./...`
code = code.replace(/from "\.\/image-workspace\//g, 'from "./');

fs.writeFileSync('src/components/image-workspace/ImageWorkspace.tsx', code);
console.log('Fixed relative imports in ImageWorkspace.tsx');
