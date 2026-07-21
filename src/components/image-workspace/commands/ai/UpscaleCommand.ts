import * as fabric from "fabric";
import { AICommand } from "./AICommand";

export class UpscaleCommand extends AICommand {
  constructor(obj: fabric.Image, modelId?: string) {
    super('Upscale Image', obj, 'upscale', modelId);
  }
}
