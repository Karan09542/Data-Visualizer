import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import { AlignmentController, AlignmentMode } from '../services/AlignmentController';
import { Artboard } from '../types/artboards';

interface AlignmentContextValue {
   alignSelection: (mode: AlignmentMode) => void;
   initializeAlignment: (
      canvas: fabric.Canvas,
      artboards: Artboard[],
      activeArtboardId: string | null,
      parentAlignmentObj: fabric.Object | null,
      executeCommand: any,
      updateLayersList: any
   ) => void;
}

const AlignmentContext = createContext<AlignmentContextValue | null>(null);

export function AlignmentProvider({ children }: { children: React.ReactNode }) {
   const stateRef = useRef({
      artboards: [] as Artboard[],
      activeArtboardId: null as string | null,
      parentAlignmentObj: null as fabric.Object | null,
      executeCommand: (cmd: any) => {},
      updateLayersList: () => {}
   });

   const [controller] = useState(() => new AlignmentController(
      () => stateRef.current.activeArtboardId,
      () => stateRef.current.artboards,
      () => stateRef.current.parentAlignmentObj,
      (cmd) => stateRef.current.executeCommand(cmd),
      () => stateRef.current.updateLayersList()
   ));

   const initializeAlignment = useCallback((
      canvas: fabric.Canvas,
      artboards: Artboard[],
      activeArtboardId: string | null,
      parentAlignmentObj: fabric.Object | null,
      executeCommand: any,
      updateLayersList: any
   ) => {
      stateRef.current = { artboards, activeArtboardId, parentAlignmentObj, executeCommand, updateLayersList };
      controller.attach(canvas);
   }, [controller]);

   const value: AlignmentContextValue = {
      alignSelection: (mode: AlignmentMode) => controller.alignSelection(mode),
      initializeAlignment
   };

   return (
      <AlignmentContext.Provider value={value}>
         {children}
      </AlignmentContext.Provider>
   );
}

export const useAlignment = () => {
   const context = useContext(AlignmentContext);
   if (!context) {
      throw new Error('useAlignment must be used within an AlignmentProvider');
   }
   return context;
};
