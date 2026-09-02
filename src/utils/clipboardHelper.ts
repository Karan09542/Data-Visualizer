/**
 * Helper for safe clipboard paste operations across all browsers and permission states.
 */

export function insertTextIntoEditor(editor: any, text: string): void {
  if (!editor || !text) return;
  try {
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits("clipboard-paste", [
        {
          range: selection,
          text: text,
          forceMoveMarkers: true,
        },
      ]);
      editor.pushUndoStop();
      editor.focus();
    }
  } catch (err) {
    console.warn("Error inserting text into editor:", err);
  }
}

export async function handleSafeEditorPaste(
  editor: any,
  onFallbackNeeded?: () => void,
): Promise<boolean> {
  if (!editor) return false;

  // 1. Try modern Async Clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (typeof text === "string" && text.length > 0) {
        insertTextIntoEditor(editor, text);
        return true;
      }
    } catch (err: any) {
      console.warn("Direct clipboard read blocked by browser permissions:", err?.message || err);
    }
  }

  // 2. If blocked or unavailable, trigger fallback paste modal
  if (typeof window !== "undefined") {
    if (onFallbackNeeded) {
      onFallbackNeeded();
    } else {
      window.dispatchEvent(
        new CustomEvent("monaco-request-paste-fallback", {
          detail: { editor },
        }),
      );
    }
  }

  return false;
}
