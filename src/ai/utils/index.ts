export async function imageToImageData(
  image: ImageBitmap | ImageData | HTMLImageElement | HTMLCanvasElement
): Promise<ImageData> {
  if (image instanceof ImageData) {
    return image;
  }
  
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') {
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    if (!ctx) throw new Error('Failed to get 2d context for image conversion');
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2d context for image conversion');
    
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
