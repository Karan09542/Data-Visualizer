import * as fabric from "fabric";
import { Command } from "../base/Command";
import { rebuildFabricFilters } from "../../services/filters/rebuildFabricFilters";
import { FilterConfig } from "../../types/filters";

// TODO(Refactor): Move to src/components/image-workspace/commands/filter/FilterPipelineCommand.ts
export class FilterPipelineCommand implements Command {
  name: string;
  private obj: any;
  private beforeFilters: FilterConfig[];
  private afterFilters: FilterConfig[];

  constructor(name: string, obj: any, beforeFilters: FilterConfig[], afterFilters: FilterConfig[]) {
    this.name = name;
    this.obj = obj;
    this.beforeFilters = JSON.parse(JSON.stringify(beforeFilters));
    this.afterFilters = JSON.parse(JSON.stringify(afterFilters));
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterFilters, updateLayers);
  }

  private apply(canvas: fabric.Canvas, stack: FilterConfig[], updateLayers: () => void) {
    this.obj.customFilters = stack;
    const filtersObj = (fabric as any).Image?.filters || (fabric as any).filters;
    if (filtersObj) {
      rebuildFabricFilters(this.obj, filtersObj);
    }
    canvas.renderAll();
    updateLayers();
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.beforeFilters, updateLayers);
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.apply(canvas, this.afterFilters, updateLayers);
  }
}
