import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useMonaco } from '@monaco-editor/react';
import SafeEditor from './SafeEditor';
import { Play, Loader2, Code2, Maximize2, Hash, X, Square } from 'lucide-react';
import { executeJsNode, abortJsNode } from '../utils/jsExecutor';

interface JsNodeCodeRendererProps {
  code: string;
  path: string; // The parent path
  width?: number;
  height?: number;
}

export function JsNodeCodeRenderer({ code, path, width, height }: JsNodeCodeRendererProps) {
  const { appTheme, jsNodeLoading, expandedJsNodeId, setExpandedJsNodeId, updateNodeValue, setJsNodeCodeOverride, jsNodeFocusLine, setJsNodeFocusLine, toggleJsNodeVisibility, setCustomNodeSize } = useStore();
  const [localCode, setLocalCode] = useState(code);
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false);
  const [goToLineValue, setGoToLineValue] = useState('');
  const isLoading = jsNodeLoading[path];

  const handleExecuteGoToLine = () => {
    if (!goToLineValue.trim()) return;
    const parts = goToLineValue.split(':');
    const line = parseInt(parts[0], 10);
    const col = parts[1] ? parseInt(parts[1], 10) : 1;
    if (editorRef.current && !isNaN(line)) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: col });
      editorRef.current.focus();
    }
    setIsGoToLineOpen(false);
  };
  const debounceRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const editorRef = React.useRef<any>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isExpanded = expandedJsNodeId === path;
  const [monaco, setMonaco] = useState<any>(null);

  // Adjust global TypeScript and JavaScript compiler options to prevent global scope clashes (e.g. Cannot redeclare block-scoped variable 'name')
  useEffect(() => {
    if (monaco) {
      try {
        if (monaco.languages && (monaco.languages as any).typescript) {
          if ((window as any).__monacoCompilerConfigured) return;
          (window as any).__monacoCompilerConfigured = true;

          const tsDefaults = (monaco.languages as any).typescript.typescriptDefaults;
          const jsDefaults = (monaco.languages as any).typescript.javascriptDefaults;

          [tsDefaults, jsDefaults].forEach((defaults) => {
            if (!defaults) return;
            const currentOptions = defaults.getCompilerOptions();
            defaults.setCompilerOptions({
              ...currentOptions,
              target: (monaco.languages as any).typescript.ScriptTarget?.Latest ?? 99,
              module: (monaco.languages as any).typescript.ModuleKind?.ESNext ?? 99,
              moduleResolution: (monaco.languages as any).typescript.ModuleResolutionKind?.NodeJs ?? 2,
              allowNonTsExtensions: false,
              isolatedModules: true,
              moduleDetection: 3, // Force treating scripts/files as independent modules
            });
            defaults.setDiagnosticsOptions({
              diagnosticCodesToIgnore: [2451, 2300]
            });
          });
        }
      } catch (err) {
        console.warn("Failed to configure Monaco compiler isolation settings in JsNodeCodeRenderer", err);
      }
    }
  }, [monaco]);

  useEffect(() => {
    if (containerRef.current) {
       const obs = new ResizeObserver((entries) => {
         for (let entry of entries) {
            // Note: entry.target.offsetWidth gives element total width including borders. contentRect gives inner width. 
            // Using offsetWidth/Height to match resize size.
            const target = entry.target as HTMLDivElement;
            const width = target.offsetWidth;
            const height = target.offsetHeight;
            if (width > 0 && height > 0) {
               window.requestAnimationFrame(() => {
                  setCustomNodeSize(path + '.__js_code', width, height);
               });
            }
         }
       });
       obs.observe(containerRef.current);
       return () => obs.disconnect();
    }
  }, [path, setCustomNodeSize]);


  useEffect(() => {
    if (jsNodeFocusLine?.path === path && editorRef.current) {
        // Only focus if we are not expanded, because if expanded, the Workspace editor should get focus.
        if (!isExpanded) {
            editorRef.current.revealLineInCenter(jsNodeFocusLine.line);
            editorRef.current.setPosition({ lineNumber: jsNodeFocusLine.line, column: jsNodeFocusLine.column || 1 });
            editorRef.current.focus();
            toggleJsNodeVisibility(path, 'code', true);
            // reset focus state
            setTimeout(() => setJsNodeFocusLine(null), 50);
        }
    }
  }, [jsNodeFocusLine, path, isExpanded, setJsNodeFocusLine, toggleJsNodeVisibility]);

  useEffect(() => {
    if (code !== localCode) {
      setLocalCode(code);
      setJsNodeCodeOverride(path, code);
    }
  }, [code, path, setJsNodeCodeOverride]);

  const updateGlobalCode = React.useCallback((newCode: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNodeValue(path, newCode);
    }, 1000);
  }, [path, updateNodeValue]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setLocalCode(value);
      setJsNodeCodeOverride(path, value);
      updateGlobalCode(value);
    }
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="flex flex-col nodrag resize overflow-hidden rounded-[14px] bg-[#0d1218] border border-[#30363d]/50 shadow-2xl relative pointer-events-auto pb-[14px] pr-[14px]" 
        style={{ minHeight: '100px', minWidth: '200px', width: width ? `${width}px` : '100%', height: height ? `${height}px` : '100%' }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header toolbar for code */}
        <div className="flex items-center justify-between p-2 border-b border-[#30363d]/50 bg-[#0d1218] drag-handle cursor-move">
           <div className="flex items-center gap-1.5 px-1">
             <Code2 size={12} className="text-[#f7df1e]" />
             <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">JS Code</span>
           </div>
           <div className="flex items-center gap-1">
             <button
                onClick={(e) => {
                   e.stopPropagation();
                   if (isLoading) {
                      abortJsNode(path);
                   } else {
                      executeJsNode(path, localCode);
                   }
                }}
                className={`flex items-center justify-center gap-1.5 py-0.5 px-2 font-medium text-[10px] rounded transition-colors ${isLoading ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-yellow-500 hover:bg-yellow-600 text-white"}`}
                title={isLoading ? "Stop Execution" : "Run Code"}
             >
                {isLoading ? <Square fill="currentColor" size={10} /> : <Play size={10} />}
                {isLoading ? "STOP" : "RUN"}
             </button>
             
             <button
                onClick={(e) => {
                   e.stopPropagation();
                   setIsGoToLineOpen(prev => !prev);
                   setGoToLineValue("");
                }}
                className="flex items-center justify-center p-1 hover:bg-[#30363d] text-slate-400 hover:text-slate-300 rounded transition-colors"
                title="Go to Line/Col (Ctrl+G)"
             >
                <Hash size={10} />
             </button>

             <button
                onClick={(e) => {
                   e.stopPropagation();
                   setExpandedJsNodeId(isExpanded ? null : path);
                }}
                className="flex items-center justify-center p-1 hover:bg-[#30363d] text-slate-400 hover:text-slate-300 rounded transition-colors"
                title="Maximize Workspace"
             >
                <Maximize2 size={10} />
             </button>
           </div>
        </div>

        {/* Code Editor */}
        {isGoToLineOpen && (
          <div className="absolute top-2 right-2 z-50 bg-[#161b22] border border-[#30363d]/50 shadow-xl rounded-md p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
            <span className="text-[10px] font-bold text-slate-400 font-mono pl-1 shrink-0">Go to:</span>
            <input
              type="text"
              placeholder="line:col (e.g. 10:5)"
              value={goToLineValue}
              onChange={(e) => setGoToLineValue(e.target.value)}
              className="bg-[#0d1218] text-slate-100 text-[11px] px-2 py-0.5 rounded border border-[#30363d] focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono w-32"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleExecuteGoToLine();
                } else if (e.key === 'Escape') {
                  setIsGoToLineOpen(false);
                  if (editorRef.current) editorRef.current.focus();
                }
              }}
            />
            <button
              onClick={handleExecuteGoToLine}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded transition-colors whitespace-nowrap"
            >
              Go
            </button>
            <button
              onClick={() => {
                setIsGoToLineOpen(false);
                if (editorRef.current) editorRef.current.focus();
              }}
              className="p-1 hover:bg-[#30363d] text-slate-400 hover:text-slate-300 rounded transition-colors block"
            >
              <X size={10} />
            </button>
          </div>
        )}
        <div className="w-full flex-1 relative bg-[#0d1218] min-h-0">
           <SafeEditor
              height="100%"
              defaultLanguage="javascript"
              language="javascript"
              theme="vs-dark"
              value={localCode}
              onChange={handleEditorChange}
              beforeMount={(m) => {
                setMonaco(m);
                try {
                  m.editor.defineTheme("customDark", {
                    base: "vs-dark",
                    inherit: true,
                    rules: [],
                    colors: {
                      "editor.background": "#0d1117",
                      "editor.lineHighlightBackground": "#161b22",
                    },
                  });
                  m.editor.defineTheme("customLight", {
                    base: "vs",
                    inherit: true,
                    rules: [],
                    colors: {
                      "editor.background": "#ffffff",
                      "editor.lineHighlightBackground": "#f1f5f9",
                    },
                  });
                } catch {
                  // ignore
                }
              }}
              onMount={(editor, monacoInstance) => { 
                editorRef.current = editor; 
                try {
                  editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyG, () => {
                    setIsGoToLineOpen(true);
                    setGoToLineValue("");
                  });
                } catch (err) {
                  console.warn("Could not register Ctrl+G command in Monaco", err);
                }
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                automaticLayout: true,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                wordWrap: 'on',
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                folding: true,
                padding: { top: 8, bottom: 8 }
              }}
           />
        </div>
      </div>
    </>
  );
}
