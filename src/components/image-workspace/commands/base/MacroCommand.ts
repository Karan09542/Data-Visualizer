import * as fabric from "fabric";
import { Command } from "./Command";

// TODO(Refactor): Move to src/components/image-workspace/commands/base/MacroCommand.ts
export class MacroCommand implements Command {
  name: string;
  private commands: Command[];

  constructor(name: string, commands: Command[]) {
    this.name = name;
    this.commands = commands;
  }

  execute(canvas: fabric.Canvas, updateLayers: () => void) {
    this.commands.forEach(cmd => cmd.execute(canvas, updateLayers));
  }

  undo(canvas: fabric.Canvas, updateLayers: () => void) {
    [...this.commands].reverse().forEach(cmd => cmd.undo(canvas, updateLayers));
  }

  redo(canvas: fabric.Canvas, updateLayers: () => void) {
    this.commands.forEach(cmd => cmd.redo(canvas, updateLayers));
  }
}
