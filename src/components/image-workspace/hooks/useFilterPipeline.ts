import { FilterConfig } from '../types/filters';
import { FilterPipelineCommand } from '../commands/filter/FilterPipelineCommand';

export const useFilterPipeline = (
  imageFilters: FilterConfig[],
  setImageFilters: (filters: FilterConfig[]) => void,
  setBenchmarkInfo: (info: any) => void,
  getTargetImageForFilters: () => any,
  executeCommand: (cmd: any) => void,
  customPresets: any[],
  setCustomPresets: (presets: any[]) => void,
  setNewPresetName: (name: string) => void,
  setShowSavePresetModal: (val: boolean) => void
) => {
  const applyFilterStack = (newStack: FilterConfig[], description = "Update Filter Studio Pipeline") => {
    const obj = getTargetImageForFilters();
    if (obj && obj.type === 'image') {
      const beforeStack = obj.customFilters || [];
      const cmd = new FilterPipelineCommand(description, obj, beforeStack, newStack);
      executeCommand(cmd);
      setImageFilters(newStack);
      if (obj.lastFilterBenchmark) {
        setBenchmarkInfo(obj.lastFilterBenchmark);
      }
    }
  };

  const addFilterToPipeline = (type: string) => {
    const base = {
      id: Date.now().toString() + Math.random().toString(),
      type,
      enabled: true,
    };
    let newItem: FilterConfig;
    switch (type) {
      case 'brightness':
        newItem = { ...base, name: 'Brightness', category: 'adjust', params: { value: 0 } };
        break;
      case 'contrast':
        newItem = { ...base, name: 'Contrast', category: 'adjust', params: { value: 0 } };
        break;
      case 'saturation':
        newItem = { ...base, name: 'Saturation', category: 'adjust', params: { value: 0 } };
        break;
      case 'vibrance':
        newItem = { ...base, name: 'Vibrance', category: 'adjust', params: { value: 0 } };
        break;
      case 'exposure':
        newItem = { ...base, name: 'Exposure', category: 'adjust', params: { value: 0 } };
        break;
      case 'hueRotation':
        newItem = { ...base, name: 'Hue Rotation', category: 'adjust', params: { value: 0 } };
        break;
      case 'gamma':
        newItem = { ...base, name: 'Gamma Channels', category: 'adjust', params: { red: 1.0, green: 1.0, blue: 1.0, value: 1.0 } };
        break;
      case 'grayscale':
        newItem = { ...base, name: 'Grayscale Mode', category: 'color', params: { mode: 'luminosity' } };
        break;
      case 'invert':
        newItem = { ...base, name: 'Invert Color', category: 'color', params: {} };
        break;
      case 'sepia':
        newItem = { ...base, name: 'Sepia Vintage', category: 'color', params: {} };
        break;
      case 'blackwhite':
        newItem = { ...base, name: 'B&W Contrast', category: 'color', params: {} };
        break;
      case 'removeColor':
        newItem = { ...base, name: 'Remove Color Key', category: 'color', params: { color: '#ffffff', distance: 0.15 } };
        break;
      case 'noise':
        newItem = { ...base, name: 'Noise & Grain', category: 'noise', params: { value: 50 } };
        break;
      case 'pixelate':
        newItem = { ...base, name: 'Pixelate Mosaic', category: 'pixel', params: { value: 8 } };
        break;
      case 'blur':
        newItem = { ...base, name: 'Gaussian Blur', category: 'blur', params: { value: 0.2 } };
        break;
      case 'edge':
        newItem = { ...base, name: 'Edge Detection', category: 'artsy', params: {} };
        break;
      case 'sharpen':
        newItem = { ...base, name: 'Sharpen Convolute', category: 'blur', params: {} };
        break;
      case 'emboss':
        newItem = { ...base, name: 'Emboss Texture', category: 'artsy', params: {} };
        break;
      case 'vignette':
        newItem = { ...base, name: 'Vignette Overlay', category: 'artsy', params: {} };
        break;
      case 'bloom':
        newItem = { ...base, name: 'Glamour Bloom', category: 'artsy', params: {} };
        break;
      case 'chromatic':
        newItem = { ...base, name: 'Chromatic Aberration', category: 'artsy', params: {} };
        break;
      case 'blendColor':
        newItem = { ...base, name: 'Blend Color Filter', category: 'blend', params: { color: '#3b82f6', mode: 'multiply', alpha: 0.4 } };
        break;
      default:
        newItem = { ...base, name: type.charAt(0).toUpperCase() + type.slice(1), category: 'adjust', params: {} };
        break;
    }

    const updated = [...imageFilters, newItem];
    applyFilterStack(updated, `Add ${newItem.name}`);
  };

  const removeFilterFromPipeline = (id: string) => {
    const updated = imageFilters.filter(f => f.id !== id);
    applyFilterStack(updated, "Remove Filter Card");
  };

  const toggleFilterEnabled = (id: string) => {
    const updated = imageFilters.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f);
    applyFilterStack(updated, "Toggle Filter Status");
  };

  const duplicateFilterInPipeline = (id: string) => {
    const filter = imageFilters.find(f => f.id === id);
    if (!filter) return;
    const duplicated: FilterConfig = {
      ...JSON.parse(JSON.stringify(filter)),
      id: Date.now().toString() + Math.random().toString(),
      name: `${filter.name} (Copy)`
    };
    const idx = imageFilters.findIndex(f => f.id === id);
    const updated = [...imageFilters];
    updated.splice(idx + 1, 0, duplicated);
    applyFilterStack(updated, `Duplicate ${filter.name}`);
  };

  const updateFilterParam = (id: string, paramName: string, value: any) => {
    const updated = imageFilters.map(f => {
      if (f.id === id) {
        return {
          ...f,
          params: { ...f.params, [paramName]: value }
        };
      }
      return f;
    });
    applyFilterStack(updated, "Tune Parameter Live");
  };

  const moveFilterInPipeline = (id: string, direction: 'up' | 'down') => {
    const index = imageFilters.findIndex(f => f.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === imageFilters.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...imageFilters];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    applyFilterStack(updated, `Reorder ${temp.name} ${direction}`);
  };

  const applyCreativePreset = (presetName: string) => {
    const base = {
      id: Date.now().toString() + Math.random().toString(),
      type: 'preset',
      category: 'presets' as const,
      enabled: true,
    };
    const presetLabels: { [key: string]: string } = {
      brownie: 'Brownie Vintage',
      vintage: 'Vintage Classic',
      technicolor: 'Technicolor Retro',
      kodachrome: 'Kodachrome Film',
      polaroid: 'Polaroid Soft',
      hdr: 'HDR Contrast',
      film: 'Fine Art Film',
      instagram: 'Instagram Vibe',
      vibrant: 'Super Vibrant',
      soft: 'Soft Cinematic'
    };
    const newItem: FilterConfig = {
      ...base,
      name: presetLabels[presetName] || 'Creative Preset',
      params: { name: presetName }
    };
    const updated = [...imageFilters, newItem];
    applyFilterStack(updated, `Apply ${newItem.name}`);
  };

  const loadSavedPreset = (preset: { name: string; stack: FilterConfig[] }) => {
    const remappedStack = preset.stack.map(f => ({
      ...f,
      id: Date.now().toString() + Math.random().toString()
    }));
    applyFilterStack(remappedStack, `Apply preset ${preset.name}`);
  };

  const saveCurrentStackAsPreset = (name: string) => {
    if (!name.trim()) return;
    const updatedPresets = [...customPresets, { name, stack: JSON.parse(JSON.stringify(imageFilters)) }];
    setCustomPresets(updatedPresets);
    try {
      localStorage.setItem("workspace_custom_filters_presets", JSON.stringify(updatedPresets));
    } catch (e) {
      console.error(e);
    }
    setNewPresetName("");
    setShowSavePresetModal(false);
  };

  const deleteCustomPreset = (name: string) => {
    const updated = customPresets.filter(p => p.name !== name);
    setCustomPresets(updated);
    try {
      localStorage.setItem("workspace_custom_filters_presets", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };


  return {
    applyFilterStack,
    addFilterToPipeline,
    removeFilterFromPipeline,
    toggleFilterEnabled,
    duplicateFilterInPipeline,
    updateFilterParam,
    moveFilterInPipeline,
    applyCreativePreset,
    loadSavedPreset,
    saveCurrentStackAsPreset,
    deleteCustomPreset
  };
};
