import React, { createContext, useContext, ReactNode } from 'react';
import * as fabric from 'fabric';

interface LayersContextType {
  layers: fabric.Object[];
  setLayers: React.Dispatch<React.SetStateAction<fabric.Object[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: React.Dispatch<React.SetStateAction<string | null>>;
  updateLayersList: () => void;
  getLayersOrder: () => { id: string, idx: number }[];
  handleLayerOrder: (action: 'front' | 'forward' | 'backward' | 'back') => void;
  selectLayer: (id: string) => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;
}

const LayersContext = createContext<LayersContextType | null>(null);

export const LayersProvider: React.FC<{
  value: LayersContextType;
  children: ReactNode;
}> = ({ value, children }) => {
  return (
    <LayersContext.Provider value={value}>
      {children}
    </LayersContext.Provider>
  );
};

export const useLayers = () => {
  const context = useContext(LayersContext);
  if (!context) {
    throw new Error('useLayers must be used within a LayersProvider');
  }
  return context;
};
