import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import { ViewportController } from '../services/ViewportController';
import { Artboard } from '../../../types/export';

interface ViewportContextValue {
   zoomPercent: number;
   setZoomPercent: React.Dispatch<React.SetStateAction<number>>;
   fitView: () => void;
   validateViewport: () => void;
   handleWheelZoom: (opt: fabric.IEvent<WheelEvent>) => void;
   initializeViewport: (
      canvas: fabric.Canvas,
      artboards: Artboard[],
      activeArtboardId: string | null,
      isMobile: boolean
   ) => void;
   updateViewportState: (
      artboards: Artboard[],
      activeArtboardId: string | null,
      isMobile: boolean
   ) => void;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

export function ViewportProvider({ children }: { children: React.ReactNode }) {
   const [zoomPercent, setZoomPercent] = useState(100);

   const stateRef = useRef({
      artboards: [] as Artboard[],
      activeArtboardId: null as string | null,
      isMobile: false
   });
   
   const setZoomPercentRef = useRef(setZoomPercent);
   setZoomPercentRef.current = setZoomPercent;

   const [controller] = useState(() => new ViewportController(
      () => stateRef.current.artboards,
      () => stateRef.current.activeArtboardId,
      () => stateRef.current.isMobile,
      (zoom) => setZoomPercentRef.current(zoom)
   ));

   const initializeViewport = useCallback((
      canvas: fabric.Canvas,
      artboards: Artboard[],
      activeArtboardId: string | null,
      isMobile: boolean
   ) => {
      stateRef.current = { artboards, activeArtboardId, isMobile };
      controller.attach(canvas);
   }, [controller]);

   const updateViewportState = useCallback((
      artboards: Artboard[],
      activeArtboardId: string | null,
      isMobile: boolean
   ) => {
      stateRef.current = { artboards, activeArtboardId, isMobile };
   }, []);

   const value: ViewportContextValue = {
      zoomPercent, 
      setZoomPercent,
      fitView: () => controller.fitView(),
      validateViewport: () => controller.validateViewport(),
      handleWheelZoom: (opt) => controller.handleWheelZoom(opt),
      initializeViewport,
      updateViewportState
   };

   return (
      <ViewportContext.Provider value={value}>
         {children}
      </ViewportContext.Provider>
   );
}

export function useViewport() {
   const context = useContext(ViewportContext);
   if (!context) {
      throw new Error("useViewport must be used within a ViewportProvider");
   }
   return context;
}
