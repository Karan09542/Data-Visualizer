
import { useStore } from "../store/useStore";

export interface WorkspaceSnapshot {
  version: string;
  timestamp: number;
  code: string;
  format: string;
  name?: string;
  settings?: {
    nodeTheme: string;
    layoutMode: string;
    edgeStyle: string;
  };
}

export const captureWorkspaceSnapshot = (): WorkspaceSnapshot => {
  const state = useStore.getState();
  return {
    version: "1.0",
    timestamp: Date.now(),
    code: state.code,
    format: state.codeFormat,
    name: state.activeDocumentName || "Workspace Export",
    settings: {
      nodeTheme: state.nodeTheme,
      layoutMode: state.layoutMode,
      edgeStyle: state.edgeStyle,
    }
  };
};

export const applyWorkspaceSnapshot = async (snapshot: WorkspaceSnapshot) => {
  const state = useStore.getState();
  
  if (snapshot.code) {
    // We can either overwrite current or save to Dexie
    // Let's do both: Add to dexie first as a backup/history, then apply to active if user confirms (handled in UI)
    return snapshot;
  }
};
