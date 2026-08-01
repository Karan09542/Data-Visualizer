import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface AutoSavePluginProps {
  onSave: (editorStateString: string) => void;
  onChange?: (editorStateString: string) => void;
  debounceMs?: number;
}

export default function AutoSavePlugin({ onSave, onChange, debounceMs = 1000 }: AutoSavePluginProps) {
  const [editor] = useLexicalComposerContext();
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Only save if there are actual changes
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      const stateString = JSON.stringify(editorState.toJSON());
      if (onChange) {
        onChange(stateString);
      }

      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        onSave(stateString);
      }, debounceMs);
    });

    return () => {
      unregister();
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editor, onSave, debounceMs]);

  return null;
}
