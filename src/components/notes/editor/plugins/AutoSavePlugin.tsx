import { useEffect, useRef, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface AutoSavePluginProps {
  onSave: (editorStateString: string) => void;
  onChange?: (editorStateString: string) => void;
  debounceMs?: number;
}

export default function AutoSavePlugin({ onSave, onChange, debounceMs = 1000 }: AutoSavePluginProps) {
  const [editor] = useLexicalComposerContext();
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingStateRef = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const flush = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingStateRef.current !== null) {
      const stateToSave = pendingStateRef.current;
      pendingStateRef.current = null;
      onSaveRef.current(stateToSave);
    }
  }, []);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Only save if there are actual changes
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      const stateString = JSON.stringify(editorState.toJSON());
      pendingStateRef.current = stateString;
      if (onChangeRef.current) {
        onChangeRef.current(stateString);
      }

      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        saveTimeoutRef.current = null;
        pendingStateRef.current = null;
        onSaveRef.current(stateString);
      }, debounceMs);
    });

    const handleBeforeUnload = () => {
      flush();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unregister();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flush();
    };
  }, [editor, debounceMs, flush]);

  return null;
}
