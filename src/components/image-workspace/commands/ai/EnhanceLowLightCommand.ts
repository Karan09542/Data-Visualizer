import * as fabric from "fabric";
import { AICommand } from "./AICommand";

export class EnhanceLowLightCommand extends AICommand {
  constructor(obj: fabric.Image, modelId?: string) {
    super('Enhance Low Light', obj, 'low-light', modelId);
  }
}
