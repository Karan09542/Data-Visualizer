import * as fabric from 'fabric';

export function placeImagesSmartly(canvas: fabric.Canvas, images: fabric.Object[], startX: number, startY: number, artboard: fabric.Object) {
  const SPACING = 20;
  let currentX = startX;
  let currentY = startY;
  let maxHeightInRow = 0;
  
  // Calculate a reasonable max width for the row based on the artboard
  const maxWidth = artboard.width! - SPACING * 2;

  canvas.discardActiveObject();
  const selection = new fabric.ActiveSelection([], { canvas });

  images.forEach((img) => {
    // Basic scaling if the image is too large for the artboard
    if (img.width! > artboard.width! * 0.8 || img.height! > artboard.height! * 0.8) {
      const scale = Math.min((artboard.width! * 0.8) / img.width!, (artboard.height! * 0.8) / img.height!);
      img.scale(scale);
    }

    const scaledWidth = img.getScaledWidth();
    const scaledHeight = img.getScaledHeight();

    if (currentX + scaledWidth > startX + maxWidth) {
      // Move to next row
      currentX = startX;
      currentY += maxHeightInRow + SPACING;
      maxHeightInRow = 0;
    }

    img.set({
      left: currentX,
      top: currentY,
    });

    currentX += scaledWidth + SPACING;
    maxHeightInRow = Math.max(maxHeightInRow, scaledHeight);
    
    canvas.add(img);
    selection.add(img);
  });

  canvas.setActiveObject(selection);
  canvas.requestRenderAll();
}
