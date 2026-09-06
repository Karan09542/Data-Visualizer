import React, { createContext, useContext, ReactNode } from 'react';

interface ToolContextType {
  activeTool: string;
  setTool: (tool: string) => void;
  brushColor: string;
  changeCurrentColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushOpacity: number;
  setBrushOpacity: (opacity: number) => void;
  brushHardness: number;
  setBrushHardness: (hardness: number) => void;
  brushFlow: number;
  setBrushFlow: (flow: number) => void;
  brushSmoothing: number;
  setBrushSmoothing: (smoothing: number) => void;
  brushType: string;
  setBrushType: (type: string) => void;
  /** 'restore' paints erased pixels back in. */
  eraseMode: 'erase' | 'restore';
  setEraseMode: (mode: 'erase' | 'restore') => void;
  textProps: any;
  setTextProps: (props: any) => void;
}

const ToolContext = createContext<ToolContextType | null>(null);

export const ToolProvider: React.FC<{
  value: ToolContextType;
  children: ReactNode;
}> = ({ value, children }) => {
  return (
    <ToolContext.Provider value={value}>
      {children}
    </ToolContext.Provider>
  );
};

export const useTool = () => {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('useTool must be used within a ToolProvider');
  }
  return context;
};
