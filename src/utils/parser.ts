import yaml from 'js-yaml';
import { isProbableCsv, parseCsv } from './dataFormats';

export const parseInput = (input: string): { data: any | null, error: string | null } => {
  if (!input.trim()) return { data: null, error: null };
  try {
    return { data: JSON.parse(input), error: null };
  } catch (e1: any) {
    try {
      if (isProbableCsv(input)) {
         return { data: parseCsv(input), error: null };
      }
      
      const data = yaml.load(input);
      if (typeof data !== 'object') {
          return { data: null, error: 'Input must evaluate to an object or array' };
      }
      return { data, error: null };
    } catch (e2: any) {
      return { data: null, error: e2.message || 'Invalid JSON, YAML, or CSV' };
    }
  }
}
