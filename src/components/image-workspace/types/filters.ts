// TODO(Refactor): Move to src/components/image-workspace/types/filters.ts
export interface FilterConfig {
  id: string;
  type: string;
  name: string;
  category: 'adjust' | 'color' | 'presets' | 'blur' | 'noise' | 'pixel' | 'blend' | 'advanced' | 'artsy' | 'webgl';
  enabled: boolean;
  /**
   * Set once the filter has been baked into the pixels of a region. It stays in the stack as a
   * record of what was applied, but must not run again or it would compound on the baked result.
   */
  baked?: boolean;
  params: { [key: string]: any };
}
