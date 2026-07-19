import React, { createContext, useContext, ReactNode } from 'react';

import * as fabric from 'fabric';

interface CanvasContextType {
  fabricRef: React.RefObject<fabric.Canvas | null>;
  enterCropMode: () => Promise<void>;
  resetCrop: () => void;
  addText: () => void;
  addRect: () => void;
  addCircle: () => void;
  addTriangle: () => void;
  addLine: () => void;
  flipX: () => void;
  flipY: () => void;
  addAlignedCollageText: (alignment: string) => void;
  updateSelectedShapeProperty: (prop: string, val: any) => void;
  changeTextProp: (prop: string, val: any, historyLabel?: string) => void;
  applyFilter: (filterId: string, val: any) => void;
  alignSelection: (alignment: string) => void;
  duplicateActiveObject: () => void;
  deleteActiveObject: () => void;
  updateArtboardPropDirect: (id: string, prop: string, val: any, saveHistory?: boolean) => void;
  generateSmartCollage: (type: string) => void;
  generateBleed: (isNegative?: boolean) => void;
  updateCollageBlockStyleProperty: (prop: string, val: any) => void;
  fillCollageBlockWithImage: (file: File) => void;
  fitCollageToArtboard: () => void;
  setZoomPercent: (zoom: number) => void;
}

const CanvasContext = createContext<CanvasContextType | null>(null);

export const CanvasProvider: React.FC<{
  value: CanvasContextType;
  children: ReactNode;
}> = ({ value, children }) => {
  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
};
