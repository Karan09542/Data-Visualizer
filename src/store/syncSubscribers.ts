import { syncService } from "./broadcastSync";
import { useStore } from "./useStore";
import { initDexieSync } from "./dexieSync";

export function setupSyncSubscribers() {
  syncService.init();

  // 1. Listen for local Zustand changes and BROADCAST them
  const unsubStore = useStore.subscribe((state, prevState) => {
    // If prevState is undefined (e.g. initial mount in some versions), ignore
    if (!prevState) return;

    // If we are currently receiving a sync from another tab, don't broadcast it back (no echo)
    if (syncService.isReceivingSync) return;

    // Detect CODE changes
    if (state.code !== prevState.code) {
      syncService.broadcast({ type: "CODE_UPDATED" });
    }

    // Detect NODE_MOVED changes (drag overrides)
    if (state.dragOverrides !== prevState.dragOverrides) {
      syncService.broadcast({ type: "NODE_MOVED" }, 100); // 100ms debounce
    }

    // Detect SETTINGS changes
    const settingsKeys = ["layoutMode", "nodeTheme", "edgeStyle", "canvasTheme", "appTheme"];
    const settingsChanged = settingsKeys.some(
      (key) => (state as any)[key] !== (prevState as any)[key]
    );
    if (settingsChanged || state.collapsedNodes !== prevState.collapsedNodes) {
      syncService.broadcast({ type: "SETTINGS_CHANGED" }, 300);
    }
    
    // Detect other workspace state changes
    if (
      state.workspaceTabs !== prevState.workspaceTabs ||
      state.activeTab !== prevState.activeTab
    ) {
      syncService.broadcast({ type: "WORKSPACE_UPDATED" });
    }
  });

  // 2. Listen for remote BroadcastChannel events and APPLY them
  const unsubs = [
    syncService.subscribe("CODE_UPDATED", () => {
      useStore.persist.rehydrate();
    }),
    syncService.subscribe("SETTINGS_CHANGED", () => {
      useStore.persist.rehydrate();
    }),
    syncService.subscribe("WORKSPACE_UPDATED", () => {
      useStore.persist.rehydrate();
    }),
    syncService.subscribe("NODE_MOVED", () => {
      // Re-fetch node positions from Dexie
      initDexieSync();
    }),
    syncService.subscribe("NODE_UPDATED", () => {
      useStore.persist.rehydrate();
    })
  ];

  return () => {
    unsubStore();
    unsubs.forEach((unsub) => unsub());
    syncService.cleanup();
  };
}
