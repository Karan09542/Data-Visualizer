// Custom worker wrapper to intercept fetch requests and serve OPFS files directly
const originalFetch = self.fetch;

self.fetch = async function(url, options) {
  const urlStr = typeof url === 'string' ? url : url.url;
  
  if (urlStr.includes('/opfs-tessdata/')) {
    try {
      const filename = urlStr.split('/').pop();
      if (!filename) throw new Error('No filename');
      
      const opfsRoot = await navigator.storage.getDirectory();
      const fileHandle = await opfsRoot.getFileHandle(filename);
      const file = await fileHandle.getFile();
      
      return new Response(file, {
        headers: {
          'Content-Type': 'application/x-gzip',
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    } catch (e) {
      console.warn('[Custom Worker] File not found in OPFS:', urlStr);
      return new Response('Not found in OPFS', { status: 404 });
    }
  }
  
  return originalFetch(url, options);
};

// Load the actual Tesseract.js worker
importScripts('/tesseract/worker.min.js');
