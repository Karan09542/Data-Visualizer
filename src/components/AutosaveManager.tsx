import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { db } from '../lib/db';

export default function AutosaveManager() {
  const { code, isAutosaveEnabled, activeDocumentId, isDirty, setIsDirty, setLastSavedCode } = useStore();
  
  // Save changes
  useEffect(() => {
    if (!isAutosaveEnabled || !isDirty || !activeDocumentId) return;

    const timer = setTimeout(async () => {
      try {
        await db.documents.update(activeDocumentId, {
          code,
          updatedAt: Date.now()
        });
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
