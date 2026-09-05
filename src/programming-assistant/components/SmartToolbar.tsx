import React, { useState, useEffect } from "react";
import { commonSymbols } from "../language";
import { insertSnippet, insertText, insertPair, undo, redo } from "../services/SnippetService";
import { useAssistantStore, AssistantItem } from "../stores/useAssistantStore";
import { ChevronDown, ChevronUp, Undo, Redo, ClipboardPaste } from "lucide-react";
import { handleSafeEditorPaste } from "../../utils/clipboardHelper";

interface SmartToolbarProps {
  editor: any;
}

export const SmartToolbar: React.FC<SmartToolbarProps> = ({ editor }) => {
  const addRecent = useAssistantStore((s) => s.addRecent);
  const isVisible = useAssistantStore((s) => s.isVisible);
  const setIsVisible = useAssistantStore((s) => s.setIsVisible);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!editor) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }

    const model = editor.getModel();
    if (!model) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }

    let history: number[] = [model.getAlternativeVersionId()];
    let currentIndex = 0;

    const updateStates = () => {
      setCanUndo(currentIndex > 0);
      setCanRedo(currentIndex < history.length - 1);
    };

    updateStates();

    let disposableContent: any = null;
    let disposableModel: any = null;

    if (typeof editor.onDidChangeModelContent === "function") {
      disposableContent = editor.onDidChangeModelContent((e: any) => {
        const currentModel = editor.getModel();
        if (!currentModel) return;
        const versionId = currentModel.getAlternativeVersionId();

        if (e.isUndoing) {
          if (currentIndex > 0) currentIndex--;
        } else if (e.isRedoing) {
          if (currentIndex < history.length - 1) currentIndex++;
        } else {
          // New edit operation
          history = history.slice(0, currentIndex + 1);
          history.push(versionId);
          currentIndex = history.length - 1;
        }

        updateStates();
      });
    }

    if (typeof editor.onDidChangeModel === "function") {
      disposableModel = editor.onDidChangeModel(() => {
        const newModel = editor.getModel();
        if (newModel) {
          history = [newModel.getAlternativeVersionId()];
          currentIndex = 0;
          updateStates();
        } else {
          setCanUndo(false);
          setCanRedo(false);
        }
      });
    }

    return () => {
      if (disposableContent && typeof disposableContent.dispose === "function") {
        disposableContent.dispose();
      }
      if (disposableModel && typeof disposableModel.dispose === "function") {
        disposableModel.dispose();
      }
    };
  }, [editor]);

  const handleInsert = (sym: AssistantItem) => {
    if (sym.isSnippet) {
      if (sym.insertText.includes("$0")) {
        insertSnippet(editor, sym.insertText);
      } else {
        insertPair(editor, sym.insertText[0], sym.insertText[1]);
      }
    } else {
      insertText(editor, sym.insertText);
    }
    addRecent(sym);
  };

  const handleUndo = () => {
    if (canUndo) {
      undo(editor);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      redo(editor);
    }
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-1.5 border-b border-[var(--vsc-border,#e5e5e5)] bg-[var(--vsc-panel,#f8f8f8)] shrink-0 touch-pan-x">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="shrink-0 h-8 min-w-[34px] px-2 rounded-[4px] bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] text-[var(--vsc-fg,#3b3b3b)] font-mono text-sm flex items-center justify-center hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] active:scale-95 transition-colors cursor-pointer mr-1"
        title="Toggle Assistant Panel"
      >
        {isVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {/* Undo Button */}
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        className={`shrink-0 h-8 px-2.5 rounded-[4px] border font-mono text-xs flex items-center gap-1.5 transition-colors mr-1 ${
          canUndo
            ? "bg-[var(--vsc-input,#ffffff)] border-[var(--vsc-border-strong,#cecece)] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] active:scale-95 cursor-pointer"
            : "bg-transparent border-[var(--vsc-border,#e5e5e5)] text-[var(--vsc-fg-muted,#616161)] opacity-50 cursor-not-allowed"
        }`}
        title="Undo change (Ctrl+Z)"
      >
        <Undo size={13} />
        <span className="font-sans font-medium">Undo</span>
      </button>

      {/* Redo Button */}
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        className={`shrink-0 h-8 px-2.5 rounded-[4px] border font-mono text-xs flex items-center gap-1.5 transition-colors mr-1 ${
          canRedo
            ? "bg-[var(--vsc-input,#ffffff)] border-[var(--vsc-border-strong,#cecece)] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] active:scale-95 cursor-pointer"
            : "bg-transparent border-[var(--vsc-border,#e5e5e5)] text-[var(--vsc-fg-muted,#616161)] opacity-50 cursor-not-allowed"
        }`}
        title="Redo change (Ctrl+Y)"
      >
        <Redo size={13} />
        <span className="font-sans font-medium">Redo</span>
      </button>

      {/* Quick Paste Button */}
      <button
        onClick={() => {
          if (editor) {
            handleSafeEditorPaste(editor);
          }
        }}
        className="shrink-0 h-8 px-2.5 rounded-[4px] border font-mono text-xs flex items-center gap-1.5 transition-colors mr-1 bg-[var(--vsc-input,#ffffff)] border-[var(--vsc-border-strong,#cecece)] text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] active:scale-95 cursor-pointer"
        title="Paste from clipboard (Ctrl+V)"
      >
        <ClipboardPaste size={13} />
        <span className="font-sans font-medium">Paste</span>
      </button>

      {/* Sleek vertical separator */}
      <div className="h-5 w-px bg-[var(--vsc-border,#e5e5e5)] mx-1 shrink-0" />

      {commonSymbols.map((sym) => (
        <button
          key={sym.id}
          onClick={() => handleInsert(sym)}
          className="shrink-0 h-8 min-w-[34px] px-2 rounded-[4px] bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border-strong,#cecece)] text-[var(--vsc-fg,#3b3b3b)] font-mono text-sm flex items-center justify-center hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] active:scale-95 transition-colors cursor-pointer"
        >
          {sym.label}
        </button>
      ))}
    </div>
  );
};
