const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'MathNodeRenderer.tsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n/);

const startIdx = lines.findIndex(l => l.startsWith('const InsertAboveIcon = ({'));
const endIdx = lines.findIndex(l => l.startsWith('export const MathNodeRenderer: React.FC<MathNodeRendererProps> = ({'));

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find start or end index.');
    process.exit(1);
}

const imports = `import {
  MathFunction,
  MathVariable,
  VariableGroup,
  COLORS,
  MATH_COMPLETIONS,
  getVarColor,
  getHexWithAlpha,
  stripAlpha,
  getStrokeDasharray,
  formatMathError,
  generateSafeId,
  computePCA,
  decoupleGeometry,
  parseAndAdjustForCompile,
  resolveNestedValue,
  indexHelper,
  extractPointsFromValue,
  deduplicatePoints,
  resolveGeometryPoints,
  InsertAboveIcon,
  InsertBelowIcon,
  ReadableColorBadge,
  PortalColorPicker,
  VariableEditorModal,
  EquationInput,
  LabelInput,
  SafeLabel,
  CurvePatternDefs,
  InequalityPlot,
  ImplicitPlot
} from "./math-node";`;

const newLines = [
    ...lines.slice(0, startIdx),
    imports,
    '',
    ...lines.slice(endIdx)
];

fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
console.log('Successfully refactored MathNodeRenderer.tsx');
