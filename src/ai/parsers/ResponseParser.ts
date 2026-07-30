export interface ParsedResponse {
  text: string;
  jsonPatch?: any; // The RFC6902 patch if provided
  reasoning?: string;
  isJSON?: boolean;
}

export class ResponseParser {
  /**
   * Parses the raw text from the AI into structured formats (like JSON Patch).
   */
  parse(rawText: string): ParsedResponse {
    let text = rawText.trim();
    let jsonPatch = undefined;
    let isJSON = false;
    
    // Attempt to parse out markdown code blocks for JSON
    const jsonBlockRegex = /```json\n([\s\S]*?)```/g;
    const match = jsonBlockRegex.exec(text);
    
    let potentialJSON = text;
    if (match && match[1]) {
      potentialJSON = match[1].trim();
    }
    
    try {
      const parsed = JSON.parse(potentialJSON);
      isJSON = true;
      // If it looks like a JSON Patch (array of operations)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].op && parsed[0].path) {
         jsonPatch = parsed;
      }
    } catch (e) {
      // It's just text
    }

    return {
      text: rawText,
      jsonPatch,
      isJSON
    };
  }
}

export const responseParser = new ResponseParser();
