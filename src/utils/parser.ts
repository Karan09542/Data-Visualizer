import yaml from 'js-yaml';
import { sanitizeWorkspaceData } from './workspaceSanitizer';

export function mapNaturalKeys(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(mapNaturalKeys);
  }
  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    let newKey = key;
    if (typeof key === "string") {
      const keyLower = key.toLowerCase();
      if (keyLower.endsWith(".ts") && !keyLower.endsWith("_ts_node")) {
        newKey = key.slice(0, -3) + "_ts_node";
      } else if (keyLower.endsWith(".js") && !keyLower.endsWith("_js_node")) {
        newKey = key.slice(0, -3) + "_js_node";
      } else if (keyLower.endsWith(".py") && !keyLower.endsWith("_py_node")) {
        newKey = key.slice(0, -3) + "_py_node";
      } else if (keyLower.endsWith(".api") && !keyLower.endsWith("_api_node")) {
        newKey = key.slice(0, -4) + "_api_node";
      } else if (keyLower.endsWith(".json") && !keyLower.endsWith("_json")) {
        newKey = key.slice(0, -5) + "_json";
      } else if (keyLower.endsWith(".yaml") && !keyLower.endsWith("_yaml")) {
        newKey = key.slice(0, -5) + "_yaml";
      } else if (keyLower.endsWith(".yml") && !keyLower.endsWith("_yml")) {
        newKey = key.slice(0, -4) + "_yml";
      } else if (keyLower.endsWith(".csv") && !keyLower.endsWith("_csv")) {
        newKey = key.slice(0, -4) + "_csv";
      } else if (keyLower.endsWith(".xml") && !keyLower.endsWith("_xml")) {
        newKey = key.slice(0, -4) + "_xml";
      } else if (keyLower.endsWith(".md") && !keyLower.endsWith("_md")) {
        newKey = key.slice(0, -3) + "_md";
      } else if (keyLower.endsWith(".txt") && !keyLower.endsWith("_txt")) {
        newKey = key.slice(0, -4) + "_txt";
      }
    }
    result[newKey] = mapNaturalKeys(val);
  }
  return result;
}

export const parseInput = (input: string): { data: any | null, error: string | null, wasSanitized?: boolean } => {
  if (!input.trim()) return { data: null, error: null };
  try {
    const parsed = JSON.parse(input);
    const mapped = mapNaturalKeys(parsed);
    const wasSanitized = sanitizeWorkspaceData(mapped);
    return { data: mapped, error: null, wasSanitized };
  } catch (e1: any) {
    try {
      const data = yaml.load(input);
      if (typeof data !== 'object') {
          return { data: null, error: 'Input must evaluate to an object or array' };
      }
      const mapped = mapNaturalKeys(data);
      const wasSanitized = sanitizeWorkspaceData(mapped);
      return { data: mapped, error: null, wasSanitized };
    } catch (e2: any) {
      return { data: null, error: e2.message || 'Invalid JSON or YAML' };
    }
  }
}
