import React, { createContext, useContext, ReactNode, useState, useMemo, useEffect } from 'react';
import * as fabric from 'fabric';
import { ClipboardController, ClipboardDependencies } from '../services/ClipboardController';
import { Artboard } from '../types/artboards';

interface ClipboardActionsContextType {
   copyActiveObjectAsFormat: (format?: 'png' | 'jpeg' | 'svg') => Promise<void>;
   duplicateActiveObject: () => void;
   duplicateArtboard: (board: Artboard) => void;
   initializeClipboard: (deps: ClipboardDependencies) => void;
   detachClipboard: () => void;
}

const ClipboardActionsContext = createContext<ClipboardActionsContextType | null>(null);

export const ClipboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const [controller] = useState(() => new ClipboardController());

   useEffect(() => {
      const handlePaste = (e: ClipboardEvent) => controller.handlePasteEvent(e);
      window.addEventListener('paste', handlePaste);
      return () => {
         window.removeEventListener('paste', handlePaste);
         controller.detach();
      };
   }, [controller]);

   const actions = useMemo<ClipboardActionsContextType>(() => ({
      copyActiveObjectAsFormat: (format) => controller.copyActiveObjectAsFormat(format),
      duplicateActiveObject: () => controller.duplicateActiveObject(),
      duplicateArtboard: (board) => controller.duplicateArtboard(board),
      initializeClipboard: (deps) => {
         controller.attach(deps);
      },
      detachClipboard: () => {
         controller.detach();
      }
   }), [controller]);

   return (
      <ClipboardActionsContext.Provider value={actions}>
         {children}
      </ClipboardActionsContext.Provider>
   );
};

export const useClipboardActions = () => {
   const context = useContext(ClipboardActionsContext);
   if (!context) {
      throw new Error('useClipboardActions must be used within a ClipboardProvider');
   }
   return context;
};
