import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { db } from '../lib/db';

export default function AutosaveManager() {
  const code = useStore((state) => state.code);
  const isAutosaveEnabled = useStore((state) => state.isAutosaveEnabled);
  const activeDocumentId = useStore((state) => state.activeDocumentId);
  const isDirty = useStore((state) => state.isDirty);
  const setIsDirty = useStore((state) => state.setIsDirty);
  const setLastSavedCode = useStore((state) => state.setLastSavedCode);

  // Save changes
  useEffect(() => {
    if (!isAutosaveEnabled || !isDirty || !activeDocumentId) return;

    const timer = setTimeout(async () => {
      try {
        const updated = await db.documents.update(activeDocumentId, {
          code,
          updatedAt: Date.now()
        });
        if (updated === 0) {
          const name = useStore.getState().activeDocumentName || 'Autosaved Document';
          const newId = await db.documents.add({
            name,
            code,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isPinned: false
          });
          useStore.getState().setActiveDocumentId(newId as number);
          useStore.getState().setActiveDocumentName(name);
        }
        setLastSavedCode(code);
        setIsDirty(false);
      } catch (err) {
        console.error('Failed to autosave document:', err);
      }
    }, 1500); // Debounce 1.5s

    return () => clearTimeout(timer);
  }, [code, isAutosaveEnabled, activeDocumentId, isDirty, setIsDirty, setLastSavedCode]);

  // Save before closing window if autosave is on
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        if (isAutosaveEnabled && activeDocumentId) {
          // Attempt a synchronous looking beacon or just let it be since IndexedDB is async
          // We can't safely await here, but the data is in Zustand persist anyway.
        } else if (!isAutosaveEnabled) {
          e.preventDefault();
          e.returnValue = '';
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isAutosaveEnabled, activeDocumentId]);

  return null;
}
