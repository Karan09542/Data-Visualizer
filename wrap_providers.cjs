const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'image-workspace', 'ImageWorkspace.tsx');
let code = fs.readFileSync(filePath, 'utf8');
code = code.replace(/\r\n/g, '\n');

// Find: export default function ImageWorkspace({ path }: ImageWorkspaceProps) {
const searchFn = "export default function ImageWorkspace({ path }: ImageWorkspaceProps) {";
const replacement = `export default function ImageWorkspace(props: ImageWorkspaceProps) {
   return (
      <ClipboardProvider>
         <HistoryProvider>
            <SelectionProvider>
               <ImageWorkspaceContent {...props} />
            </SelectionProvider>
         </HistoryProvider>
      </ClipboardProvider>
   );
}

function ImageWorkspaceContent({ path }: ImageWorkspaceProps) {`;

code = code.replace(searchFn, replacement);

fs.writeFileSync(filePath, code);
console.log('Wrapped components successfully!');
