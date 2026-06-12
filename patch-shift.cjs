const fs = require('fs');
const filepath = './src/components/ImageWorkspace.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// handleBrushAdjustMousemove
content = content.replace(
/const isShift = e\.shiftKey \|\| isShiftPressedRef\.current;\s*const isCtrl = e\.ctrlKey \|\| isCtrlPressedRef\.current;/g,
`const isCtrl = e.ctrlKey || isCtrlPressedRef.current;`
);

content = content.replace(
/if \(isCtrl && !isShift\) {[\s\n]*activeBrushPropertyRef\.current = 'hardness';[\s\n]*setActiveBrushProperty\('hardness'\);[\s\n]*} else {[\s\n]*activeBrushPropertyRef\.current = 'opacity';[\s\n]*setActiveBrushProperty\('opacity'\);[\s\n]*}/g,
`activeBrushPropertyRef.current = 'opacity';
                 setActiveBrushProperty('opacity');`
);


// handleBrushAdjustMousedown
content = content.replace(
/const isShift = e\.shiftKey \|\| isShiftPressedRef\.current;\s*const isCtrl = e\.ctrlKey \|\| isCtrlPressedRef\.current;\s*if \(\(isShift \|\| isCtrl\) && e\.button === 0\) {/g,
`const isCtrl = e.ctrlKey || isCtrlPressedRef.current;
       
       if (isCtrl && e.button === 0) {`
);

content = content.replace(
/const initialProp = isCtrl && !isShift \? 'hardness' : \(isShift && !isCtrl \? 'opacity' : 'size'\);/g,
`const initialProp = 'size';`
);

// touchStartHandler
content = content.replace(
/const hasModifier = isShiftPressedRef\.current \|\| isCtrlPressedRef\.current;/g,
`const hasModifier = isCtrlPressedRef.current;`
);

content = content.replace(
/const isShift = isShiftPressedRef\.current;\s*const isCtrl = isCtrlPressedRef\.current;/g,
`const isCtrl = isCtrlPressedRef.current;`
);

// touchMoveHandler
content = content.replace(
/const isShift = isShiftPressedRef\.current;\s*const isCtrl = isCtrlPressedRef\.current;\s*\/\/ Auto-lock axis on touch gesture/g,
`const isCtrl = isCtrlPressedRef.current;

        // Auto-lock axis on touch gesture`
);

// mouse:wheel
content = content.replace(
/e\.ctrlKey \|\| e\.shiftKey \|\| isShiftPressedRef\.current \|\| isCtrlPressedRef\.current/g,
`e.ctrlKey || isCtrlPressedRef.current`
);

fs.writeFileSync(filepath, content, 'utf8');
console.log("Patched ImageWorkspace.tsx to remove shiftKey logic for dynamic brushes");
