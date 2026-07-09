import React, { createContext, useContext, ReactNode } from 'react';
import * as fabric from 'fabric';

interface SelectionContextType {
  activeObj: fabric.Object | null;
  activeObjs: fabric.Object[];
  activeSelection: boolean;
  isCollageBlock: boolean;
  isCollageSelected: boolean;
  parentAlignmentObj: fabric.Object | null;
  setParentAlignmentObj: (obj: fabric.Object | null) => void;
  selectionType: string | null;
  setSelectionType: (type: string | null) => void;
  // Layout properties
  textObj: fabric.IText | null;
  textContent: string;
}

const SelectionContext = createContext<SelectionContextType | null>(null);

export const SelectionProvider: React.FC<{
  value: SelectionContextType;
  children: ReactNode;
}> = ({ value, children }) => {
  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
};

export const useSelection = () => {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
};
