import { useStore } from '../store/useStore';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import { Play, Code, Loader2, Globe } from 'lucide-react';

export default function EditorPanel() {
  const { code, setCode, clearCode, error, parsedData, appTheme } = useStore();
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState<'raw' | 'api'>('raw');
  const [apiUrl, setApiUrl] = useState('https://jsonplaceholder.typicode.com/todos/1');
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiHeaders, setApiHeaders] = useState('{\n  "Accept": "application/json"\n}');
  const [apiBody, setApiBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

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
      if (editorRef.current && activeTab === 'raw') {
        editorRef.current.getAction('editor.action.formatDocument').run();
      }
    };
    window.addEventListener('format-editor', handleFormat);
    return () => window.removeEventListener('format-editor', handleFormat);
  }, [activeTab]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleFetch = async () => {
    if (!apiUrl) {
      setApiError('URL is required');
      return;
    }

    if (apiUrl.startsWith('http://') || (apiUrl && !apiUrl.includes('://'))) {
      setApiError('Secure Connection Required: To protect your data, only HTTPS sources are supported. Please use a secure (https://) URL.');
      return;
    }
    
    setIsLoading(true);
    setApiError('');
    try {
      let headers = {};
      try {
        if (apiHeaders.trim()) {
          headers = JSON.parse(apiHeaders);
        }
      } catch (e) {
        throw new Error('Invalid JSON in Headers');
      }
      
      const options: RequestInit = {
        method: apiMethod,
        headers,
      };
      
      if (apiMethod !== 'GET' && apiMethod !== 'HEAD' && apiBody.trim()) {
        options.body = apiBody;
      }

      const response = await fetch(apiUrl, options);
      const data = await response.text();
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${data.substring(0, 50)}...`);
      }
      
      // Try to format if it's JSON
      try {
        const parsed = JSON.parse(data);
        setCode(JSON.stringify(parsed, null, 2));
      } catch {
        setCode(data);
      }
      setActiveTab('raw');
    } catch (e: any) {
      setApiError(e.message || 'Fetch failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0d1117] overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-2 px-4 py-2 border-r border-slate-300 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'raw' ? 'bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
          >
            <Code size={14} /> Editor
          </button>
          <button 
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-2 px-4 py-2 border-r border-slate-300 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'api' ? 'bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
          >
            <Globe size={14} /> Fetch API
          </button>
        </div>
        <div className="pr-4 flex items-center gap-3">
          <button
            id="editor-clear-button"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the editor?')) {
                clearCode();
                // Force monaco to update immediately if ref is available
                if (editorRef.current) {
                  editorRef.current.setValue('');
                }
              }
            }}
            className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-500 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            Clear
          </button>
          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-800" />
          {error && activeTab === 'raw' && <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded truncate max-w-[200px]" title={error}>{error}</span>}
          {!error && parsedData && activeTab === 'raw' && <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Valid JSON/YAML</span>}
        </div>
      </div>
      
      <div className="flex-1 w-full relative">
        {activeTab === 'raw' && (
          <div className="h-full pt-2">
            <Editor
              height="100%"
              defaultLanguage={code.trim().startsWith('{') || code.trim().startsWith('[') ? 'json' : 'yaml'}
              language={code.trim().startsWith('{') || code.trim().startsWith('[') ? 'json' : 'yaml'}
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
        )}

        {activeTab === 'api' && (
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 text-slate-800 dark:text-slate-200">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Request URL</label>
              <div className="flex rounded-md overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                <select 
                  value={apiMethod} 
                  onChange={(e) => setApiMethod(e.target.value)}
                  className="bg-slate-200 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium outline-none text-blue-600 dark:text-blue-400"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <input 
                  type="text" 
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.example.com/data"
                  className="flex-1 bg-white dark:bg-[#0f172a] px-3 py-2 text-sm outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 h-32">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Headers (JSON)</label>
              <div className="flex-1 w-full border border-slate-300 dark:border-slate-700 rounded-md overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 flex flex-col relative z-0">
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={apiHeaders}
                  onChange={(val) => setApiHeaders(val || '')}
                  theme={appTheme === 'dark' ? 'customDark' : 'customLight'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    folding: false,
                    lineNumbersMinChars: 2,
                    padding: { top: 8, bottom: 8 },
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    scrollbar: { vertical: 'hidden' },
                    renderLineHighlight: 'none'
                  }}
                />
              </div>
            </div>

            {['POST', 'PUT', 'PATCH'].includes(apiMethod) && (
              <div className="flex flex-col gap-1 h-40">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Body Request</label>
                <div className="flex-1 w-full border border-slate-300 dark:border-slate-700 rounded-md overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 flex flex-col relative z-0">
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    value={apiBody}
                    onChange={(val) => setApiBody(val || '')}
                    theme={appTheme === 'dark' ? 'customDark' : 'customLight'}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      folding: true,
                      lineNumbersMinChars: 2,
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {apiError && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="mt-0.5 min-w-[14px]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  </div>
                  <div>
                    {apiError}
                    <a 
                      href="https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block mt-1 font-bold underline hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                    >
                      Learn more about secure connections
                    </a>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end">
                <button 
                  onClick={handleFetch}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-70 text-white rounded-md text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  Send Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
