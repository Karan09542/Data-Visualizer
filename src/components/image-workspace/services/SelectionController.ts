import * as fabric from 'fabric';

export interface SelectionState {
   activeObject: fabric.Object | null;
   activeObjects: fabric.Object[];
   activeSelection: boolean;
   isMultipleSelection: boolean;
   selectionType: string | null;
   parentAlignmentObj: fabric.Object | null;
   textObj: fabric.IText | null;
   textContent: string;
   
   // TODO: Extract this out into CollageProvider later
   isCollageBlock: boolean;
   isCollageSelected: boolean;
}

export class SelectionController {
   private canvas: fabric.Canvas | null = null;
   private onStateChange: (state: SelectionState) => void;
   
   private parentAlignmentObj: fabric.Object | null = null;
   
   constructor(onStateChange: (state: SelectionState) => void) {
      this.onStateChange = onStateChange;
      
      this.handleSelection = this.handleSelection.bind(this);
   }

   public attach(canvas: fabric.Canvas) {
      if (this.canvas) {
         this.detach();
      }
      this.canvas = canvas;
      
      this.canvas.on('selection:created', this.handleSelection);
      this.canvas.on('selection:updated', this.handleSelection);
      this.canvas.on('selection:cleared', this.handleSelection);
      
      // Initialize with current state
      this.handleSelection();
   }

   public detach() {
      if (!this.canvas) return;
      
      this.canvas.off('selection:created', this.handleSelection);
      this.canvas.off('selection:updated', this.handleSelection);
      this.canvas.off('selection:cleared', this.handleSelection);
      
      this.canvas = null;
   }
   
   public setParentAlignmentObj(obj: fabric.Object | null) {
       this.parentAlignmentObj = obj;
       this.handleSelection();
   }

   private handleSelection() {
      if (!this.canvas) return;
      
      const activeObj = this.canvas.getActiveObject() || null;
      const activeObjs = this.canvas.getActiveObjects() || [];
      
      // Handle parent alignment object lifecycle
      if (activeObj) {
         if (activeObj.type === 'activeSelection') {
            const selObjects = (activeObj as fabric.ActiveSelection).getObjects();
            if (this.parentAlignmentObj && !selObjects.includes(this.parentAlignmentObj)) {
               this.parentAlignmentObj = null;
            }
         } else {
            this.parentAlignmentObj = null;
         }
      } else {
         this.parentAlignmentObj = null;
      }
      
      const selectionType = activeObj?.type || null;
      
      // Collage check (TODO: move out)
      const isCollageBlock = activeObj?.type === 'rect' && (activeObj as any).id?.startsWith('collage-block-');
      const isCollageSelected = !!activeObj && ((activeObj as any).isCollageBlock || (activeObj.type === 'activeSelection' && (activeObj as fabric.ActiveSelection).getObjects().some(o => (o as any).isCollageBlock)));
      
      const textObj = activeObj as any;
      const textContent = textObj?.text || '';

      const newState: SelectionState = {
         activeObject: activeObj,
         activeObjects: activeObjs,
         activeSelection: !!activeObj,
         isMultipleSelection: activeObjs.length > 1,
         selectionType,
         parentAlignmentObj: this.parentAlignmentObj,
         textObj: textObj?.type === 'i-text' || textObj?.type === 'text' || textObj?.type === 'textbox' ? textObj : null,
         textContent,
         isCollageBlock,
         isCollageSelected
      };
      
      this.onStateChange(newState);
   }
}
