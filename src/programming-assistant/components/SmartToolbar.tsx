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
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-1 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1117] shrink-0 touch-pan-x">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="shrink-0 h-8 min-w-[36px] px-2 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-mono text-sm shadow-sm flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-800/50 active:scale-95 transition-all mr-1"
        title="Toggle Assistant Panel"
      >
        {isVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {/* Undo Button */}
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        className={`shrink-0 h-8 px-2.5 rounded-md border font-mono text-xs shadow-sm flex items-center gap-1.5 transition-all mr-1 ${
          canUndo
            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 active:scale-95 cursor-pointer"
            : "bg-slate-50 dark:bg-[#161b22] border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed"
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
        className={`shrink-0 h-8 px-2.5 rounded-md border font-mono text-xs shadow-sm flex items-center gap-1.5 transition-all mr-1 ${
          canRedo
            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 active:scale-95 cursor-pointer"
            : "bg-slate-50 dark:bg-[#161b22] border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed"
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
        className="shrink-0 h-8 px-2.5 rounded-md border font-mono text-xs shadow-sm flex items-center gap-1.5 transition-all mr-1 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 cursor-pointer"
        title="Paste from clipboard (Ctrl+V)"
      >
        <ClipboardPaste size={13} />
        <span className="font-sans font-medium">Paste</span>
      </button>

      {/* Sleek vertical separator */}
      <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

      {commonSymbols.map((sym) => (
        <button
          key={sym.id}
          onClick={() => handleInsert(sym)}
          className="shrink-0 h-8 min-w-[36px] px-2 rounded-md bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-sm shadow-sm flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
        >
          {sym.label}
        </button>
      ))}
    </div>
  );
};
