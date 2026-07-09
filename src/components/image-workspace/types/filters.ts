// TODO(Refactor): Move to src/components/image-workspace/types/filters.ts
export interface FilterConfig {
  id: string;
  type: string;
  name: string;
  category: 'adjust' | 'color' | 'presets' | 'blur' | 'noise' | 'pixel' | 'blend' | 'advanced' | 'artsy';
  enabled: boolean;
  params: { [key: string]: any };
}
