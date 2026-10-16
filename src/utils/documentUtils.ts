/**
 * Utilities for document state detection and validation
 */

/**
 * Determines whether a document code string is effectively empty or just a blank placeholder
 */
export function isDocumentEmpty(code: string | null | undefined): boolean {
  if (!code) return true;
  const trimmed = code.trim();
  if (
    trimmed === '' ||
    trimmed === '{}' ||
    trimmed === '{\n}' ||
    trimmed === '{\n  \n}' ||
    trimmed === '[]' ||
    trimmed === '[\n]' ||
    trimmed === '[\n  \n]'
  ) {
    return true;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || parsed === undefined) return true;
    if (typeof parsed === 'object') {
      if (Array.isArray(parsed)) return parsed.length === 0;
      const keys = Object.keys(parsed);
      if (keys.length === 0) return true;
      // If it's just the default blank workspace object
      if (keys.length === 1 && keys[0] === 'workspace' && parsed.workspace === 'My Blank Workspace') {
        return true;
      }
    }
  } catch {
    // Non-JSON or syntax error content is not considered empty
    return false;
  }

  return false;
}
