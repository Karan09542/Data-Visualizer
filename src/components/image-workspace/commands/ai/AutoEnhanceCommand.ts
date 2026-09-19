import * as fabric from "fabric";
import { AICommand } from "./AICommand";

export class AutoEnhanceCommand extends AICommand {
  constructor(obj: fabric.Image, modelId?: string) {
    super('Auto Enhance Image', obj, 'auto-enhance', modelId);
  }
}
