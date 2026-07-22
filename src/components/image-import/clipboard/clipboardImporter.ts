export interface ClipboardImportResult {
  url: string;
  type: 'image' | 'svg';
  name?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  assetId?: string;
}

export async function processClipboardItems(items: ClipboardItems): Promise<ClipboardImportResult[]> {
  const results: ClipboardImportResult[] = [];
  
  for (const item of items) {
    if (item.types.includes('image/svg+xml')) {
      const blob = await item.getType('image/svg+xml');
      const text = await blob.text();
      const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
      results.push({ url, type: 'svg', blob, name: 'Pasted SVG' });
    } else if (item.types.includes('image/png')) {
      const blob = await item.getType('image/png');
      const url = URL.createObjectURL(blob);
      results.push({ url, type: 'image', blob, name: 'Pasted PNG' });
    } else if (item.types.includes('image/jpeg')) {
      const blob = await item.getType('image/jpeg');
      const url = URL.createObjectURL(blob);
      results.push({ url, type: 'image', blob, name: 'Pasted JPEG' });
    } else if (item.types.includes('image/webp')) {
      const blob = await item.getType('image/webp');
      const url = URL.createObjectURL(blob);
      results.push({ url, type: 'image', blob, name: 'Pasted WebP' });
    } else if (item.types.includes('text/html')) {
      const blob = await item.getType('text/html');
      const text = await blob.text();
      // Try to extract images from HTML
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const imgs = doc.querySelectorAll('img');
      imgs.forEach(img => {
        if (img.src) {
           results.push({ url: img.src, type: img.src.includes('.svg') || img.src.includes('image/svg+xml') ? 'svg' : 'image' });
        }
      });
    } else if (item.types.includes('text/plain')) {
      const blob = await item.getType('text/plain');
      const text = await blob.text();
      if (text.startsWith('http') && (text.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || text.includes('images.unsplash.com'))) {
        results.push({ url: text.trim(), type: text.includes('.svg') ? 'svg' : 'image' });
      } else if (text.trim().startsWith('<svg') && text.trim().endsWith('</svg>')) {
        const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text.trim())))}`;
        results.push({ url, type: 'svg', name: 'Pasted SVG text' });
      } else if (text.startsWith('data:image/')) {
        results.push({ url: text.trim(), type: text.includes('image/svg+xml') ? 'svg' : 'image' });
      }
    }
  }
  
  return results;
}

export async function processPasteEvent(e: React.ClipboardEvent | ClipboardEvent): Promise<ClipboardImportResult[]> {
  const results: ClipboardImportResult[] = [];
  
  if (e.clipboardData && e.clipboardData.items) {
    const items = Array.from(e.clipboardData.items);
    
    // Check what types of data we have in the clipboard payload
    const hasImageFile = items.some(item => item.type.indexOf('image/') !== -1 && item.kind === 'file');
    const hasHtml = items.some(item => item.type === 'text/html');

    // Process items concurrently and await them all
    const processPromises = items.map(async (item) => {
      if (item.type.indexOf('image/') !== -1 && item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          if (file.type === 'image/svg+xml') {
            const text = await file.text();
            const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
            results.push({ url, type: 'svg', blob: file, name: file.name });
          } else {
            const url = URL.createObjectURL(file);
            results.push({ url, type: 'image', blob: file, name: file.name });
          }
        }
      } else if (item.type === 'text/html' && !hasImageFile) {
         // Only fallback to HTML parsing if there are no direct image files
         return new Promise<void>((resolve) => {
            item.getAsString((html) => {
               const doc = new DOMParser().parseFromString(html, 'text/html');
               const imgs = doc.querySelectorAll('img');
               imgs.forEach(img => {
                  if (img.src && !img.src.startsWith('file://')) {
                     results.push({ url: img.src, type: img.src.includes('.svg') || img.src.includes('image/svg+xml') ? 'svg' : 'image' });
                  }
               });
               resolve();
            });
         });
      } else if (item.type === 'text/plain' && !hasImageFile && !hasHtml) {
         // Only fallback to plain text if there are no images and no HTML
         return new Promise<void>((resolve) => {
            item.getAsString((text) => {
               if (text.startsWith('http') && text.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
                  results.push({ url: text.trim(), type: text.includes('.svg') ? 'svg' : 'image' });
               } else if (text.trim().startsWith('<svg') && text.trim().endsWith('</svg>')) {
                  const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text.trim())))}`;
                  results.push({ url, type: 'svg', name: 'Pasted SVG text' });
               } else if (text.startsWith('data:image/')) {
                  results.push({ url: text.trim(), type: text.includes('image/svg+xml') ? 'svg' : 'image' });
               }
               resolve();
            });
         });
      }
    });

    await Promise.all(processPromises);
  }
  
  return results;
}
