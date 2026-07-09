import * as fabric from "fabric";
import { Command } from "../base/Command";

// TODO(Refactor): Move to src/components/image-workspace/commands/filter/FilterPipelineCommand.ts
export class FilterChangeCommand implements Command {
  name: string;
  private obj: fabric.Object;
  private filterType: string;
  private beforeValue: number;
  private afterValue: number;

  constructor(name: string, obj: fabric.Object, filterType: string, beforeValue: number, afterValue: number) {
    this.name = name;
    this.obj = obj;
    this.filterType = filterType;
    this.beforeValue = beforeValue;
    this.afterValue = afterValue;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterValue, updateLayers);
  }

  private apply(canvas: fabric.Canvas, val: number, updateLayers: () => void) {
    const obj = this.obj as any;
    const filters = (fabric as any).Image?.filters || (fabric as any).filters;
    if (!filters) return;
    
    let filterIndex = -1;
    if (this.filterType === 'brightness') filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Brightness);
    else if (this.filterType === 'contrast') filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Contrast);
    else if (this.filterType === 'saturation') filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Saturation);
    else if (this.filterType === 'grayscale') filterIndex = obj.filters.findIndex((f: any) => f instanceof filters.Saturation);

    let filter;
    if (this.filterType === 'brightness') filter = new filters.Brightness({ brightness: val });
    else if (this.filterType === 'contrast') filter = new filters.Contrast({ contrast: val });
    else if (this.filterType === 'saturation') filter = new filters.Saturation({ saturation: val });
    else if (this.filterType === 'grayscale') filter = new filters.Saturation({ saturation: -val });

    if (filterIndex >= 0) {
      if (filter) obj.filters[filterIndex] = filter;
      else obj.filters.splice(filterIndex, 1);
    } else {
      if (filter) obj.filters.push(filter);
    }
    
    obj.applyFilters();
    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.beforeValue, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterValue, updateLayers);
  }
}
