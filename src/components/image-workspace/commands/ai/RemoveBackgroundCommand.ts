import * as fabric from "fabric";
import { AICommand } from "./AICommand";

export class RemoveBackgroundCommand extends AICommand {
  constructor(obj: fabric.Image, modelId?: string) {
    super('Remove Background', obj, 'background-removal', modelId);
  }
}
