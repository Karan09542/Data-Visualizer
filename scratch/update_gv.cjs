const fs = require('fs');
let content = fs.readFileSync('src/components/GraphVisualizer.tsx', 'utf8');

// 1. Add Import
if (!content.includes('import { NodeEditingModal }')) {
  content = content.replace(
    'import { NodeContextMenu } from "./NodeContextMenu";', 
    'import { NodeContextMenu } from "./NodeContextMenu";\nimport { NodeEditingModal } from "./NodeEditingModal";'
  );
}

// 2. Replace Block
const startStr = '{/* Editing Modal */}';
const endStr = '{mediaInfoModal &&';

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `{/* Editing Modal */}
      <NodeEditingModal
        editingNode={editingNode}
        setEditingNode={setEditingNode}
        applyJsonChange={applyJsonChange}
      />

      `;
  content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  fs.writeFileSync('src/components/GraphVisualizer.tsx', content);
  console.log('Successfully updated GraphVisualizer.tsx');
} else {
  console.error('Could not find bounds for replacement.');
}
