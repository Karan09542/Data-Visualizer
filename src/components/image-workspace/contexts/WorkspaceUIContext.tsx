import React, { createContext, useContext, ReactNode } from 'react';
import { Artboard } from '../types/artboards';

interface WorkspaceUIContextType {
  isMobile: boolean;
  setShowShortcuts: (val: boolean) => void;
  setActiveTab: (val: any) => void;
  handleImportImageClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  artboards: any[];
  setArtboards: (val: any) => void;
  activeArtboardId: string | null;
  setActiveArtboardId: (id: string) => void;
  imageFilters: any[];
  setImageFilters: (filters: any[]) => void;
  benchmarkInfo: any;
  setBenchmarkInfo: (info: any) => void;
  createArtboard: (presetName?: string, customW?: number, customH?: number) => void;
  createArtboardFromPreset: (presetName?: string, customW?: number, customH?: number) => void;
  duplicateArtboard: (board: any) => void;
  deleteArtboard: (id: string) => void;
  updateArtboardProp: (id: string, prop: string, value: any) => void;
  onArtboardPropStart: (val: any) => void;
  onArtboardPropCommit: (id: string, prop: string, value: any) => void;
}

const WorkspaceUIContext = createContext<WorkspaceUIContextType | null>(null);

export const WorkspaceUIProvider: React.FC<{
  value: WorkspaceUIContextType;
  children: ReactNode;
}> = ({ value, children }) => {
  return (
    <WorkspaceUIContext.Provider value={value}>
      {children}
    </WorkspaceUIContext.Provider>
  );
};

export const useWorkspaceUI = () => {
  const context = useContext(WorkspaceUIContext);
  if (!context) {
    throw new Error('useWorkspaceUI must be used within a WorkspaceUIProvider');
  }
  return context;
};
