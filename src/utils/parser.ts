import yaml from 'js-yaml';

export const parseInput = (input: string): { data: any | null, error: string | null } => {
  if (!input.trim()) return { data: null, error: null };
  try {
    return { data: JSON.parse(input), error: null };
  } catch (e1: any) {
    try {
      const data = yaml.load(input);
      if (typeof data !== 'object') {
          return { data: null, error: 'Input must evaluate to an object or array' };
      }
      return { data, error: null };
    } catch (e2: any) {
      return { data: null, error: e2.message || 'Invalid JSON or YAML' };
    }
  }
}
