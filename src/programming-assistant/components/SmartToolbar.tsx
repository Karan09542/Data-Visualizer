import React from "react";
import { commonSymbols } from "../language";
import { insertSnippet, insertText, insertPair } from "../services/SnippetService";
import { useAssistantStore, AssistantItem } from "../stores/useAssistantStore";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SmartToolbarProps {
  editor: any;
}

export const SmartToolbar: React.FC<SmartToolbarProps> = ({ editor }) => {
  const addRecent = useAssistantStore((s) => s.addRecent);
  const isVisible = useAssistantStore((s) => s.isVisible);
  const setIsVisible = useAssistantStore((s) => s.setIsVisible);

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

  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-1 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1117] shrink-0 touch-pan-x">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="shrink-0 h-8 min-w-[36px] px-2 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-mono text-sm shadow-sm flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-800/50 active:scale-95 transition-all mr-1"
        title="Toggle Assistant Panel"
      >
        {isVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
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
