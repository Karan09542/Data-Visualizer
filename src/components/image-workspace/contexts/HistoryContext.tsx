import React, { createContext, useContext, ReactNode } from 'react';

interface HistoryContextType {
  commandIndex: number;
  historyNames: string[];
  performUndo: () => void;
  performRedo: () => void;
  executeCommand: (command: any) => void;
}

const HistoryContext = createContext<HistoryContextType | null>(null);

export const HistoryProvider: React.FC<{
  value: HistoryContextType;
  children: ReactNode;
}> = ({ value, children }) => {
  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};
