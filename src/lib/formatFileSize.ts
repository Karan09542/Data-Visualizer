/**
 * Formats a file size in bytes or kilobytes into a human-readable string.
 * @param size The size to format.
 * @param unit The unit of the input size ('B' or 'KB'). Defaults to 'KB' based on current app usage.
 * @param decimals How many decimal places to include. Defaults to 2.
 */
export function formatFileSize(size: number, unit: 'B' | 'KB' = 'KB', decimals: number = 2): string {
  if (size === 0) return '0 B';

  // Convert to bytes first if input is in KB
  let bytes = unit === 'KB' ? size * 1024 : size;
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
