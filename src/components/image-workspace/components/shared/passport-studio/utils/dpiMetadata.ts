// Set DPI metadata in JPEG images (JFIF APP0 marker density bytes)
export function setJpegDPI(dataUrl: string, dpi: number): string {
  try {
    const parts = dataUrl.split(',');
    if (!parts[1]) return dataUrl;
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Check SOI (FF D8) and APP0 (FF E0)
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF && bytes[3] === 0xE0) {
      bytes[13] = 1; // 1 = dots per inch
      bytes[14] = (dpi >> 8) & 0xFF;
      bytes[15] = dpi & 0xFF;
      bytes[16] = (dpi >> 8) & 0xFF;
      bytes[17] = dpi & 0xFF;

      let outStr = '';
      for (let i = 0; i < bytes.length; i++) outStr += String.fromCharCode(bytes[i]);
      return parts[0] + ',' + btoa(outStr);
    }
  } catch (err) {
    console.error('Error setting JPEG DPI metadata:', err);
  }
  return dataUrl;
}

// Set DPI metadata in PNG images (pHYs chunk insertion)
export function setPngDPI(dataUrl: string, dpi: number): string {
  try {
    const parts = dataUrl.split(',');
    if (!parts[1]) return dataUrl;
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Pixels per meter = dpi * 39.3701
    const ppm = Math.round(dpi * 39.3701);

    // Build pHYs data: 4 bytes type ('pHYs') + 4 bytes ppm_x + 4 bytes ppm_y + 1 byte unit (1 = meter)
    const physData = new Uint8Array(13);
    physData[0] = 0x70; physData[1] = 0x48; physData[2] = 0x59; physData[3] = 0x73;
    physData[4] = (ppm >> 24) & 0xFF;
    physData[5] = (ppm >> 16) & 0xFF;
    physData[6] = (ppm >> 8) & 0xFF;
    physData[7] = ppm & 0xFF;
    physData[8] = (ppm >> 24) & 0xFF;
    physData[9] = (ppm >> 16) & 0xFF;
    physData[10] = (ppm >> 8) & 0xFF;
    physData[11] = ppm & 0xFF;
    physData[12] = 1; // 1 = meters

    // CRC32 calculation over type + data
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < physData.length; i++) {
      crc ^= physData[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;

    // Build complete pHYs chunk: 4 bytes length (00 00 00 09) + 13 bytes physData + 4 bytes CRC
    const chunk = new Uint8Array(21);
    chunk[0] = 0; chunk[1] = 0; chunk[2] = 0; chunk[3] = 9;
    chunk.set(physData, 4);
    chunk[17] = (crc >> 24) & 0xFF;
    chunk[18] = (crc >> 16) & 0xFF;
    chunk[19] = (crc >> 8) & 0xFF;
    chunk[20] = crc & 0xFF;

    // PNG signature (8 bytes) + IHDR chunk (25 bytes) ends at offset 33
    const ihdrEnd = 33;
    if (bytes.length > ihdrEnd && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      const newBytes = new Uint8Array(bytes.length + chunk.length);
      newBytes.set(bytes.subarray(0, ihdrEnd), 0);
      newBytes.set(chunk, ihdrEnd);
      newBytes.set(bytes.subarray(ihdrEnd), ihdrEnd + chunk.length);

      let outStr = '';
      for (let i = 0; i < newBytes.length; i++) outStr += String.fromCharCode(newBytes[i]);
      return parts[0] + ',' + btoa(outStr);
    }
  } catch (err) {
    console.error('Error setting PNG DPI metadata:', err);
  }
  return dataUrl;
}
