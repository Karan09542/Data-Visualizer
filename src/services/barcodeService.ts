import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

// Setup ZXing reader with hints to detect all formats and try harder
const hints = new Map();
hints.set(DecodeHintType.TRY_HARDER, true);

// Include standard 1D/2D formats we expect
const formats = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.AZTEC,
  BarcodeFormat.PDF_417,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF
];
hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

const reader = new BrowserMultiFormatReader(hints);

export const decodeBarcodeFromImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = async () => {
      try {
        const result = await reader.decodeFromImageElement(img);
        resolve(result.getText());
      } catch (e: any) {
        if (e.name === 'NotFoundException') {
          reject(new Error('No barcode or QR code found in the image.'));
        } else {
          reject(e);
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for scanning.'));
    };

    img.src = objectUrl;
  });
};
