import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import { SnappingController, Guide } from '../services/SnappingController';
import { Artboard } from '../../../types/export';

interface SnappingContextValue {
   isSnappingEnabled: boolean;
   setIsSnappingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
   snapTolerance: number;
   setSnapTolerance: React.Dispatch<React.SetStateAction<number>>;
   guides: Guide[];
   setGuides: React.Dispatch<React.SetStateAction<Guide[]>>;
   clearSnapping: () => void;
   initializeSnapping: (
      canvas: fabric.Canvas,
      artboards: Artboard[],
      isAltPressed: boolean
   ) => void;
   updateSnappingState: (
      artboards: Artboard[],
      isAltPressed: boolean
   ) => void;
}

const SnappingContext = createContext<SnappingContextValue | null>(null);

export function SnappingProvider({ children }: { children: React.ReactNode }) {
   const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
   const [snapTolerance, setSnapTolerance] = useState(10);
   const [guides, setGuides] = useState<Guide[]>([]);

   const stateRef = useRef({
      artboards: [] as Artboard[],
      isAltPressed: false
   });

   const isSnappingEnabledRef = useRef(isSnappingEnabled);
   const snapToleranceRef = useRef(snapTolerance);
   const setGuidesRef = useRef(setGuides);

   isSnappingEnabledRef.current = isSnappingEnabled;
   snapToleranceRef.current = snapTolerance;
   setGuidesRef.current = setGuides;

   const [controller] = useState(() => new SnappingController(
      () => stateRef.current.artboards,
      () => isSnappingEnabledRef.current,
      () => snapToleranceRef.current,
      () => stateRef.current.isAltPressed,
      (newGuides) => setGuidesRef.current(newGuides)
   ));

   const initializeSnapping = useCallback((
      canvas: fabric.Canvas,
      artboards: Artboard[],
      isAltPressed: boolean
   ) => {
      stateRef.current = { artboards, isAltPressed };
      controller.attach(canvas);
   }, [controller]);

   const updateSnappingState = useCallback((
      artboards: Artboard[],
      isAltPressed: boolean
   ) => {
      stateRef.current = { artboards, isAltPressed };
   }, []);

   const value: SnappingContextValue = {
      isSnappingEnabled,
      setIsSnappingEnabled,
      snapTolerance,
      setSnapTolerance,
      guides,
      setGuides,
      clearSnapping: () => controller.clearSnapping(),
      initializeSnapping,
      updateSnappingState
   };

   return (
      <SnappingContext.Provider value={value}>
         {children}
      </SnappingContext.Provider>
   );
}

export function useSnapping() {
   const context = useContext(SnappingContext);
   if (!context) {
      throw new Error("useSnapping must be used within a SnappingProvider");
   }
   return context;
}
