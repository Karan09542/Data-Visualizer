import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { db } from '../lib/db';

let initialAutosaveLoaded = false;

export default function AutosaveManager() {
  const { code, setCode, isAutosaveEnabled } = useStore();
  const lastSavedCode = useRef(code);
  const [hasLoadedAutosave, setHasLoadedAutosave] = useState(false);

  // Load autosave on mount
  useEffect(() => {
    async function loadAutosave() {
      // Don't load autosave if we're opening a shared link
      if (window.location.hash.startsWith('#share=')) {
        setHasLoadedAutosave(true);
        initialAutosaveLoaded = true;
        return;
      }

      if (initialAutosaveLoaded) {
        setHasLoadedAutosave(true);
        return;
      }

      try {
        const existingAutosave = await db.documents.where('name').equals('Autosaved Document').first();
        if (existingAutosave && existingAutosave.code) {
          setCode(existingAutosave.code);
          lastSavedCode.current = existingAutosave.code;
        }
      } catch (err) {
        console.error('Failed to load autosaved document:', err);
      } finally {
        setHasLoadedAutosave(true);
        initialAutosaveLoaded = true;
      }
    }

    loadAutosave();
  }, [setCode]);

  // Save changes
  useEffect(() => {
    if (!isAutosaveEnabled || !hasLoadedAutosave) return;

    if (code === lastSavedCode.current) return;

    const timer = setTimeout(async () => {
      try {
        const existingAutosave = await db.documents.where('name').equals('Autosaved Document').first();
        if (existingAutosave) {
          await db.documents.update(existingAutosave.id, {
            code,
            updatedAt: Date.now()
          });
        } else {
          await db.documents.add({
            name: 'Autosaved Document',
            code,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
        lastSavedCode.current = code;
      } catch (err) {
        console.error('Failed to autosave document:', err);
      }
    }, 1500); // Debounce 1.5s

    return () => clearTimeout(timer);
  }, [code, isAutosaveEnabled, hasLoadedAutosave]);

  return null;
}
