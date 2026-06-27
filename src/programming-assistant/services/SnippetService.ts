export const insertSnippet = (editor: any, snippet: string) => {
  if (!editor) return;
  const snippetController = editor.getContribution("snippetController2");
  if (snippetController) {
    snippetController.insert(snippet);
  } else {
    // Fallback if snippetController2 is not available
    const position = editor.getPosition();
    editor.executeEdits("assistant", [
      {
        // range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        range: new editor.constructor.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: snippet.replace(/\$\{\d+:([^}]+)\}/g, "$1").replace(/\$\d+/g, "")
      }
    ]);
  }
  editor.focus();
};

export const insertText = (editor: any, text: string) => {
  if (!editor) return;
  const selections = editor.getSelections();
  if (!selections || selections.length === 0) return;
  
  const edits = selections.map((selection: any) => ({
    range: selection,
    text: text,
    forceMoveMarkers: true,
  }));
  
  editor.executeEdits("assistant", edits);
  editor.focus();
};

export const insertPair = (editor: any, open: string, close: string) => {
  if (!editor) return;
  const selections = editor.getSelections();
  if (!selections || selections.length === 0) return;
  
  const edits = selections.map((selection: any) => ({
    range: selection,
    text: open + close,
    forceMoveMarkers: true,
  }));
  
  editor.executeEdits("assistant", edits);
  
  // Move cursors inside the pair
  const newSelections = selections.map((selection: any) => {
    return new editor.constructor.Selection(
      selection.startLineNumber,
      selection.startColumn + open.length,
      selection.startLineNumber,
      selection.startColumn + open.length
    );
  });
  
  editor.setSelections(newSelections);
  editor.focus();
};

export const undo = (editor: any) => {
  if (!editor) return;
  try {
    // Try Monaco command trigger first
    editor.trigger("keyboard", "undo", null);
  } catch (e) {
    console.error("Monaco keyboard undo trigger failed:", e);
  }
  // Fallback direct model undo
  if (editor.getModel && typeof editor.getModel === "function") {
    const model = editor.getModel();
    if (model && typeof model.undo === "function") {
      try {
        model.undo();
      } catch (e) {
        console.error("Monaco model undo failed:", e);
      }
    }
  }
  editor.focus();
};

export const redo = (editor: any) => {
  if (!editor) return;
  try {
    // Try Monaco command trigger first
    editor.trigger("keyboard", "redo", null);
  } catch (e) {
    console.error("Monaco keyboard redo trigger failed:", e);
  }
  // Fallback direct model redo
  if (editor.getModel && typeof editor.getModel === "function") {
    const model = editor.getModel();
    if (model && typeof model.redo === "function") {
      try {
        model.redo();
      } catch (e) {
        console.error("Monaco model redo failed:", e);
      }
    }
  }
  editor.focus();
};

