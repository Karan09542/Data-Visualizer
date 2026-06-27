import React, { useState, useEffect } from 'react';

export function useMonacoUndoRedo(editor: any) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!editor) return;

    let history: number[] = [];
    let currentIndex = -1;

    const updateState = () => {
      setCanUndo(currentIndex > 0);
      setCanRedo(currentIndex < history.length - 1);
    };

    const model = editor.getModel();
    if (model) {
      history = [model.getAlternativeVersionId()];
      currentIndex = 0;
      updateState();
    }

    const disposableContent = editor.onDidChangeModelContent((e: any) => {
      const currentModel = editor.getModel();
      if (!currentModel) return;
      const versionId = currentModel.getAlternativeVersionId();

      if (e.isUndoing) {
        if (currentIndex > 0) currentIndex--;
      } else if (e.isRedoing) {
        if (currentIndex < history.length - 1) currentIndex++;
      } else {
        // New edit
        history = history.slice(0, currentIndex + 1);
        history.push(versionId);
        currentIndex = history.length - 1;
      }
      updateState();
    });

    const disposableModel = editor.onDidChangeModel(() => {
      const newModel = editor.getModel();
      if (newModel) {
        history = [newModel.getAlternativeVersionId()];
        currentIndex = 0;
      } else {
        history = [];
        currentIndex = -1;
      }
      updateState();
    });

    return () => {
      disposableContent?.dispose();
      disposableModel?.dispose();
    };
  }, [editor]);

  return { canUndo, canRedo };
}
