import JSZip from 'jszip';

self.onmessage = async (e) => {
  const { id, files, folderName } = e.data;
  
  try {
    const zip = new JSZip();
    
    for (const { file, path } of files) {
      zip.file(path, file);
    }
    
    const zipBlob = await zip.generateAsync({ 
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      }
    }, (metadata) => {
      self.postMessage({ id, progress: metadata.percent });
    });
    
    const zipFile = new File([zipBlob], `${folderName}.zip`, { type: "application/zip" });
    
    self.postMessage({ id, zipFile });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
