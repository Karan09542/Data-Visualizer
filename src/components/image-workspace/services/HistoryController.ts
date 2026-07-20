import * as fabric from 'fabric';

export interface HistoryState {
   commandIndex: number;
   historyNames: string[];
}

export class HistoryController {
   private canvas: fabric.Canvas | null = null;
   private commandStack: any[] = [];
   private commandIndex: number = -1;
   private updateLayersList: () => void = () => {};
   private onStateChange: (state: HistoryState) => void = () => {};
   private setIsInternalChange: (val: boolean) => void = () => {};

   attach(
      canvas: fabric.Canvas,
      updateLayersList: () => void,
      setIsInternalChange: (val: boolean) => void,
      onStateChange: (state: HistoryState) => void
   ) {
      this.canvas = canvas;
      this.updateLayersList = updateLayersList;
      this.setIsInternalChange = setIsInternalChange;
      this.onStateChange = onStateChange;
      this.emitState();
   }

   detach() {
      this.canvas = null;
      this.updateLayersList = () => {};
      this.setIsInternalChange = () => {};
      this.onStateChange = () => {};
   }

   executeCommand(command: any) {
      if (!this.canvas) return;

      this.setIsInternalChange(true);
      command.execute(this.canvas, this.updateLayersList);
      this.setIsInternalChange(false);

      const nextIndex = this.commandIndex + 1;
      this.commandStack = this.commandStack.slice(0, nextIndex);
      this.commandStack.push(command);
      this.commandIndex = nextIndex;

      // Ensure stack size doesn't grow unbounded (currently capped at 50 in original code)
      if (this.commandStack.length > 50) {
         this.commandStack.shift();
         this.commandIndex--; // Shift down the index as well
      }

      this.emitState();
   }

   performUndo() {
      if (this.commandIndex >= 0 && this.canvas) {
         this.setIsInternalChange(true);
         const cmd = this.commandStack[this.commandIndex];
         cmd.undo(this.canvas, this.updateLayersList);
         this.commandIndex -= 1;
         this.setIsInternalChange(false);
         this.emitState();
      }
   }

   performRedo() {
      const nextIndex = this.commandIndex + 1;
      if (nextIndex < this.commandStack.length && this.canvas) {
         this.setIsInternalChange(true);
         const cmd = this.commandStack[nextIndex];
         cmd.redo(this.canvas, this.updateLayersList);
         this.commandIndex = nextIndex;
         this.setIsInternalChange(false);
         this.emitState();
      }
   }

   jumpToHistory(idx: number) {
      if (!this.canvas) return;
      this.setIsInternalChange(true);

      while (this.commandIndex > idx) {
         const cmd = this.commandStack[this.commandIndex];
         cmd.undo(this.canvas, this.updateLayersList);
         this.commandIndex -= 1;
      }
      while (this.commandIndex < idx) {
         const nextIndex = this.commandIndex + 1;
         const cmd = this.commandStack[nextIndex];
         cmd.redo(this.canvas, this.updateLayersList);
         this.commandIndex = nextIndex;
      }
      
      this.setIsInternalChange(false);
      this.emitState();
   }

   private emitState() {
      this.onStateChange({
         commandIndex: this.commandIndex,
         historyNames: this.commandStack.map(c => c.name || 'Action')
      });
   }
}
