import { useStore } from '../store/useStore';

export const processFiles = async (files: File[]) => {
  if (files.length === 0) return;
  
  // Currently processing the first file
  // TODO: Add bulk process UI support
  const file = files[0];
  const { name, type, size } = file;
  
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');
  const isAudio = type.startsWith('audio/');
  const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  const isExcel = type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                  type === 'application/vnd.ms-excel' || 
                  name.toLowerCase().endsWith('.xlsx') || 
                  name.toLowerCase().endsWith('.xls');
  
  const isMedia = isImage || isVideo || isAudio || isPdf;
  
  if (isMedia) {
     const hash = isImage ? '#image' : isVideo ? '#video' : isAudio ? '#audio' : isPdf ? '#pdf' : '';
     const blobUrl = URL.createObjectURL(file) + hash;
     useStore.getState().setPendingImport({
         filename: name,
         fileContext: 'media',
         mimeType: type,
         fileSize: size,
         blobUrl
     });
     return;
  }
  
  const isTextLike = type.startsWith('text/') || type === 'application/json' || type === 'application/xml' || type === 'application/yaml' || name.match(/\.(json|csv|yaml|yml|tsv|txt|md|xml)$/i);

  if (!isMedia && !isExcel && !isTextLike) {
      useStore.getState().setNotification({ 
          message: `Unsupported file type: ${name}. Please upload text, data, or standard media files.`, 
          type: 'error' 
      });
      return;
  }
  
  const reader = new FileReader();
  reader.onload = async (event) => {
      const result = event.target?.result;
      if (!result) return;
      
      if (isExcel) {
          try {
              const { parseExcel } = await import('./dataFormats');
              const dataExcel = parseExcel(result as ArrayBuffer);
              useStore.getState().setPendingImport({
                  filename: name,
                  fileContext: 'data',
                  mimeType: type,
                  fileSize: size,
                  dataExcel
              });
          } catch(e) {
              console.error('Failed to parse Excel', e);
          }
      } else {
          useStore.getState().setPendingImport({
              filename: name,
              text: result as string,
              fileContext: 'data',
              mimeType: type,
              fileSize: size
          });
      }
  };
  
  if (isExcel) {
      reader.readAsArrayBuffer(file);
  } else {
      reader.readAsText(file);
  }
};
