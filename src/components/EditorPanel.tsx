import { useStore } from '../store/useStore';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';

export default function EditorPanel() {
  const { code, setCode, error, parsedData, appTheme } = useStore();
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('customDark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0d1117',
          'editor.lineHighlightBackground': '#161b22',
        }
      });
      monaco.editor.defineTheme('customLight', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#ffffff',
          'editor.lineHighlightBackground': '#f1f5f9',
        }
      });
      monaco.editor.setTheme(appTheme === 'dark' ? 'customDark' : 'customLight');
    }
  }, [monaco, appTheme]);

  useEffect(() => {
    const handleFormat = () => {
      if (editorRef.current) {
        editorRef.current.getAction('editor.action.formatDocument').run();
      }
    };
    window.addEventListener('format-editor', handleFormat);
    return () => window.removeEventListener('format-editor', handleFormat);
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0d1117] overflow-hidden">
      <div className="flex items-center justify-between opacity-80 pl-4 py-2 border-b border-slate-300 dark:border-slate-800">
        <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Input Data (JSON/YAML)</span>
        {error && <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded truncate max-w-[200px]" title={error}>{error}</span>}
        {!error && parsedData && <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Valid</span>}
      </div>
      <div className="flex-1 w-full pt-2">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme={appTheme === 'dark' ? 'customDark' : 'customLight'}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            folding: true,
            lineNumbersMinChars: 3,
            formatOnPaste: true,
            padding: { top: 10, bottom: 10 }
          }}
        />
      </div>
    </div>
  );
}
