import { jsonrepair } from 'jsonrepair';

export interface ParsedResponse {
  text: string;
  jsonPatch?: any[]; // The RFC6902 patch if provided or auto-constructed
  parsedData?: any;  // Raw JSON object/array if valid JSON
  reasoning?: string;
  isJSON?: boolean;
}

export class ResponseParser {
  /**
   * Attempts to parse JSON string, falling back to jsonrepair if standard JSON.parse fails.
   */
  private parseJSONWithRepair(str: string): any {
    if (!str || !str.trim()) return null;
    const trimmed = str.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      try {
        const repaired = jsonrepair(trimmed);
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
  }

  /**
   * Normalizes a JSON patch operation object so fast-json-patch doesn't fail.
   */
  private normalizeOperation(opObj: any): any | null {
    if (!opObj || typeof opObj !== 'object') return null;

    let op = typeof opObj.op === 'string' ? opObj.op.toLowerCase().trim() : '';
    if (op === 'update') op = 'replace';

    const validOps = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
    if (!validOps.includes(op)) return null;

    let rawPath = opObj.path;
    if (rawPath === undefined || rawPath === null) rawPath = '';
    rawPath = String(rawPath).trim();

    // Fix path: RFC 6902 path must be "" for root, or start with "/"
    let path = rawPath;
    if (path !== '' && !path.startsWith('/')) {
      path = '/' + path;
    }

    const cleaned: any = { op, path };

    if (op === 'add' || op === 'replace' || op === 'test') {
      cleaned.value = opObj.value !== undefined ? opObj.value : null;
    }

    if (op === 'move' || op === 'copy') {
      let rawFrom = opObj.from;
      if (rawFrom === undefined || rawFrom === null) rawFrom = '';
      rawFrom = String(rawFrom).trim();
      if (rawFrom !== '' && !rawFrom.startsWith('/')) {
        rawFrom = '/' + rawFrom;
      }
      cleaned.from = rawFrom;
    }

    return cleaned;
  }

  /**
   * Sanitizes an array of patch operations.
   */
  private extractValidPatchArray(arr: any[]): any[] | undefined {
    if (!Array.isArray(arr) || arr.length === 0) return undefined;

    const cleanedOps: any[] = [];
    for (const item of arr) {
      const norm = this.normalizeOperation(item);
      if (norm) {
        cleanedOps.push(norm);
      }
    }

    return cleanedOps.length > 0 ? cleanedOps : undefined;
  }

  /**
   * Parses raw text from AI into structured formats (like JSON Patch or raw JSON).
   */
  parse(rawText: string): ParsedResponse {
    if (!rawText) {
      return { text: '', jsonPatch: undefined, parsedData: undefined, isJSON: false };
    }

    const text = rawText.trim();
    let jsonPatch: any[] | undefined = undefined;
    let parsedData: any = undefined;
    let isJSON = false;

    // Strategy 1: Extract from markdown code blocks (```json ... ``` or ``` ...)
    const codeBlockRegex = /```(?:json|JSON)?\s*[\r\n]+([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const codeBlockContent = match[1].trim();
      const parsed = this.parseJSONWithRepair(codeBlockContent);
      if (parsed !== null) {
        isJSON = true;
        parsedData = parsed;
        if (Array.isArray(parsed)) {
          const patch = this.extractValidPatchArray(parsed);
          if (patch) {
            jsonPatch = patch;
            break;
          }
        } else if (parsed && typeof parsed === 'object') {
          const candidateArray = parsed.patch || parsed.operations || parsed.diff;
          if (Array.isArray(candidateArray)) {
            const patch = this.extractValidPatchArray(candidateArray);
            if (patch) {
              jsonPatch = patch;
              break;
            }
          }
        }
      }
    }

    // Strategy 2: If no codeblock yielded a patch, try parsing raw text directly as JSON (with repair)
    if (!jsonPatch && !parsedData) {
      const parsed = this.parseJSONWithRepair(text);
      if (parsed !== null) {
        isJSON = true;
        parsedData = parsed;
        if (Array.isArray(parsed)) {
          jsonPatch = this.extractValidPatchArray(parsed);
        } else if (parsed && typeof parsed === 'object') {
          const candidateArray = parsed.patch || parsed.operations || parsed.diff;
          if (Array.isArray(candidateArray)) {
            jsonPatch = this.extractValidPatchArray(candidateArray);
          }
        }
      }
    }

    // Strategy 3: Search for embedded JSON array [...] anywhere in the text
    if (!jsonPatch && !parsedData) {
      const arrayRegex = /\[\s*\{[\s\S]*?\}\s*\]/g;
      let arrMatch: RegExpExecArray | null;
      while ((arrMatch = arrayRegex.exec(text)) !== null) {
        const parsed = this.parseJSONWithRepair(arrMatch[0]);
        if (parsed !== null && Array.isArray(parsed)) {
          parsedData = parsed;
          const patch = this.extractValidPatchArray(parsed);
          if (patch) {
            jsonPatch = patch;
            isJSON = true;
            break;
          }
        }
      }
    }

    // Strategy 4: Fallback jsonrepair on extracted JSON block or text substring if repair is needed
    if (!jsonPatch && !parsedData) {
      try {
        const repairedStr = jsonrepair(text);
        const parsed = JSON.parse(repairedStr);
        if (parsed !== null && typeof parsed === 'object') {
          isJSON = true;
          parsedData = parsed;
          if (Array.isArray(parsed)) {
            jsonPatch = this.extractValidPatchArray(parsed);
          }
        }
      } catch {
        // Unrepairable text
      }
    }

    // If valid JSON was parsed but no RFC 6902 patch ops were found, auto-generate a root replace patch
    if (parsedData !== undefined && !jsonPatch) {
      jsonPatch = [{ op: 'replace', path: '', value: parsedData }];
    }

    return {
      text: rawText,
      jsonPatch,
      parsedData,
      isJSON,
    };
  }
}

export const responseParser = new ResponseParser();

