const fs = require('fs');
const content = `
export const createPatternSource = (type: string, color: string, size: number) => {
  const canvas = document.createElement('canvas');
  const sizeValue = Math.max(12, size);
  canvas.width = sizeValue;
  canvas.height = sizeValue;
  const ctx = canvas.getContext('2d')!;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  if (type === 'dots') {
    ctx.beginPath();
    ctx.arc(sizeValue / 2, sizeValue / 2, sizeValue / 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'dashed') {
    ctx.beginPath();
    ctx.moveTo(0, sizeValue);
    ctx.lineTo(sizeValue, 0);
    ctx.stroke();
  } else if (type === 'texture') {
    ctx.beginPath();
    ctx.moveTo(sizeValue / 2, 0);
    ctx.lineTo(sizeValue / 2, sizeValue);
    ctx.moveTo(0, sizeValue / 2);
    ctx.lineTo(sizeValue, sizeValue / 2);
    ctx.stroke();
  } else if (type === 'decorative') {
    ctx.beginPath();
    ctx.moveTo(sizeValue / 2, 0);
    ctx.lineTo(sizeValue, sizeValue / 2);
    ctx.lineTo(sizeValue / 2, sizeValue);
    ctx.lineTo(0, sizeValue / 2);
    ctx.closePath();
    ctx.fill();
  } else { // 'repeating_shapes'
    ctx.beginPath();
    ctx.rect(sizeValue / 4, sizeValue / 4, sizeValue / 2, sizeValue / 2);
    ctx.fill();
  }

  return canvas;
};
`;
fs.appendFileSync('src/components/image-workspace/fabric/brushes.ts', content);
console.log('Appended createPatternSource');
