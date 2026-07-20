const fs = require('fs');

let code = fs.readFileSync('src/components/ImageWorkspace.tsx', 'utf-8');

const mappings = [
    { regex: /^\/\/ Custom Fabric\.Rect render override/m, label: 'fabric/overrides.ts' },
    { regex: /^\/\/ jSquash WASM URL assets/m, label: 'services/export/jsquash.ts' },
    { regex: /^const loadWasmModule =/m, label: 'services/export/jsquash.ts' },
    { regex: /^const hasSimd =/m, label: 'services/export/jsquash.ts' },
    { regex: /^const hasThreads =/m, label: 'services/export/jsquash.ts' },
    { regex: /^const setOpacityOnHex =/m, label: 'utils/color.ts' },
    { regex: /^const getBrushName =/m, label: 'fabric/brushes.ts' },
    { regex: /^const createPatternSource =/m, label: 'fabric/brushes.ts' },
    { regex: /^interface Command \{/m, label: 'commands/base/Command.ts' },
    { regex: /^class MacroCommand /m, label: 'commands/base/MacroCommand.ts' },
    { regex: /^class AddObjectCommand /m, label: 'commands/object/AddObjectCommand.ts' },
    { regex: /^class DeleteObjectCommand /m, label: 'commands/object/DeleteObjectCommand.ts' },
    { regex: /^class TransformObjectsCommand /m, label: 'commands/object/TransformCommand.ts' },
    { regex: /^class PropertyChangeCommand /m, label: 'commands/object/PropertyCommand.ts' },
    { regex: /^class StyleChangeCommand /m, label: 'commands/object/PropertyCommand.ts' },
    { regex: /^class LayerReorderCommand /m, label: 'commands/layer/LayerReorderCommand.ts' },
    { regex: /^class FilterChangeCommand /m, label: 'commands/filter/FilterPipelineCommand.ts' },
    { regex: /^export interface FilterConfig /m, label: 'types/filters.ts' },
    { regex: /^export function rebuildFabricFilters/m, label: 'services/filters/rebuildFabricFilters.ts' },
    { regex: /^class FilterPipelineCommand /m, label: 'commands/filter/FilterPipelineCommand.ts' },
    { regex: /^const BrushPreview =/m, label: 'components/panels/BrushPreview.tsx' },
    { regex: /^interface Artboard \{/m, label: 'types/artboards.ts' },
    { regex: /^class ArtboardStateCommand /m, label: 'commands/artboard/ArtboardStateCommand.ts' },
    { regex: /^class DuplicateArtboardCommand /m, label: 'commands/artboard/DuplicateArtboardCommand.ts' },
    { regex: /^class DeleteArtboardCommand /m, label: 'commands/artboard/DeleteArtboardCommand.ts' },
    { regex: /^class ArtboardPropertyCommand /m, label: 'commands/artboard/ArtboardStateCommand.ts' },
    { regex: /^const ModernCheckbox =/m, label: 'components/shared/ModernCheckbox.tsx' },
    { regex: /^const ARTBOARD_PRESETS =/m, label: 'services/export/presets.ts' },
    { regex: /^const ObjectDimensionsPanel =/m, label: 'components/panels/ObjectDimensionsPanel.tsx' },
    { regex: /^function dataURLtoFile/m, label: 'utils/file.ts' },
    { regex: /^const ColorPickerPortal =/m, label: 'components/shared/ColorPickers.tsx' },
    { regex: /^const ColorPickerTrigger =/m, label: 'components/shared/ColorPickers.tsx' },
    { regex: /^const ContextMenuItem =/m, label: 'components/shared/ContextMenuItem.tsx' },
    { regex: /^const ToolBtn =/m, label: 'components/shared/ToolBtn.tsx' },
    { regex: /^const TabBtn =/m, label: 'components/shared/TabBtn.tsx' },
    { regex: /^const BtnSelect =/m, label: 'components/shared/BtnSelect.tsx' },
    { regex: /^const FilterSlider =/m, label: 'components/shared/FilterSlider.tsx' },
];

let modified = code;
for (const { regex, label } of mappings) {
    modified = modified.replace(regex, `// TODO(Refactor): Move to src/components/image-workspace/${label}\n$&`);
}

modified = modified.replace(/^export default function ImageWorkspace\(/m, `// TODO(Refactor): Extract hooks, leaving only the main orchestration here\n$&`);

fs.writeFileSync('src/components/ImageWorkspace.tsx', modified);
console.log('TODO markers added successfully.');
