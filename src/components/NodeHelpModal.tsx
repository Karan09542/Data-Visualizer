import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Network, Globe, Play, Edit, HelpCircle, Code, Plus, ArrowRight, CheckCircle2, FileJson, Terminal } from 'lucide-react';
import { useStore } from '../store/useStore';

interface NodeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NodeHelpModal: React.FC<NodeHelpModalProps> = ({ isOpen, onClose }) => {
  const { code, setCode, appTheme } = useStore();
  const [activeTab, setActiveTab] = useState<'api' | 'js' | 'ts' | 'py'>('api');

  const handleInsertExample = async () => {
    try {
      const { parsedData, codeFormat, setCode, setCodeFormat } = useStore.getState();

      const demoFields = {
        demo_user_info: "Demographic and details panel",
        github_profile_api_node: "https://api.github.com/users/octocat",
        posts_api_node: "https://jsonplaceholder.typicode.com/posts/1",
        ip_lookup_api_node: "https://ipapi.co/json/",
        calculator_js_node: "console.log('JS calculation node executing!');\nconsole.log('namaste');",
        greeting_ts_node: "const name: string = 'World';\nconsole.log(`Hello ${name}!`);\nconsole.log('namaste');",
        greeting_py_node: 'text = "World"\nprint(f"Hello {text}!")\nprint("namaste")'
      };

      const demoNodes = {
        demo_user_info: "Demographic and details panel",
        github_profile_api_node: "https://api.github.com/users/octocat",
        posts_api_node: "https://jsonplaceholder.typicode.com/posts/1",
        meta: {
          api_status: "online",
          ip_lookup_api_node: "https://ipapi.co/json/",
          run_calc_js_node: "console.log('Math calculation:', Math.random() * 100);\nconsole.log('namaste');",
          format_date_ts_node: "console.log('Current ISO Date:', new Date().toISOString());\nconsole.log('namaste');",
          greeting_py_node: 'text = "World"\nprint(f"Hello {text}!")\nprint("namaste")'
        }
      };

      let newCode = '';

      let currentData: any = {};
      if (parsedData && typeof parsedData === 'object') {
        if (Array.isArray(parsedData)) {
          currentData = parsedData.map(row => ({
            ...row,
            ...demoFields
          }));
        } else {
          currentData = { ...parsedData, demo_nodes: demoNodes };
        }
      } else {
        currentData = {
          project_name: "Visualizer Showcase",
          demo_nodes: demoNodes
        };
      }

      if (codeFormat === 'yaml') {
        try {
          const yaml = (await import('js-yaml')).default;
          newCode = yaml.dump(currentData);
        } catch {
          newCode = JSON.stringify(currentData, null, 2);
        }
      } else {
        newCode = JSON.stringify(currentData, null, 2);
      }

      setCode(newCode);
      onClose();
    } catch (e) {
      console.error("Could not insert example", e);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full max-w-2xl border rounded-2xl shadow-2xl overflow-hidden font-sans ${
              appTheme === 'dark' ? 'bg-[#0f172a] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            {/* Header */}
            <div className={`flex flex-col border-b ${
              appTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <div className="flex items-center justify-between p-4 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <HelpCircle className="text-indigo-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Interactive Nodes Guide</h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Smart View Integrations</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className={`p-2 rounded-full transition-colors ${
                    appTheme === 'dark' 
                      ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' 
                      : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex px-4 gap-4 mt-2">
                <button
                  onClick={() => setActiveTab('api')}
                  className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'api' 
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Network size={16} /> API Nodes
                </button>
                <button
                  onClick={() => setActiveTab('js')}
                  className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'js' 
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <FileJson size={16} /> JS Nodes
                </button>
                <button
                  onClick={() => setActiveTab('ts')}
                  className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'ts' 
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Code size={16} /> TS Nodes
                </button>
                <button
                  onClick={() => setActiveTab('py')}
                  className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'py' 
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Terminal size={16} /> Python Nodes
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6 text-sm">
              {activeTab === 'api' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-200' : 'bg-indigo-50/50 border-indigo-100 text-indigo-700'
                  }`}>
                    <Globe className="shrink-0 mt-0.5" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are API Nodes?</span>
                      If any JSON/YAML key ends with the suffix <code className="font-mono bg-indigo-500/10 dark:bg-indigo-500/20 px-1 py-0.5 rounded text-xs font-bold">_api_node</code> and contains a String URL value, this tool turns that key into an interactive, clickable API endpoint directly inside your graph view!
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Edit size={16} className="text-amber-500" />
                        <span>Inline Configuration</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Double-click the URL or click the Edit button inside the interactive node to configure:
                      </p>
                      <ul className="mt-2 space-y-1 text-xs list-disc pl-4 text-slate-600 dark:text-slate-300">
                        <li>Request Method (<code className="font-mono">GET</code>, <code className="font-mono">POST</code>, <code className="font-mono">PUT</code>, etc.)</li>
                        <li>Response Format (<code className="font-mono">JSON</code>, <code className="font-mono">Text</code>, <code className="font-mono">Blob</code>)</li>
                        <li>Timeout threshold in milliseconds</li>
                      </ul>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Play size={16} className="text-emerald-500" />
                        <span>Live Response Mounts</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Instantly load remote APIs. When executed:
                      </p>
                      <ul className="mt-2 space-y-1 text-xs list-disc pl-4 text-slate-600 dark:text-slate-300">
                        <li>The query fires through our safe proxy layer</li>
                        <li>A live loader reflects connection states</li>
                        <li>The response dynamically expands into a <code className="font-mono text-emerald-500">__fetched</code> node directory!</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold flex items-center gap-1.5 mb-2.5">
                      <Code size={16} className="text-blue-500" /> Defining an API Node in JSON
                    </span>
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto border ${
                      appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-indigo-300' : 'bg-slate-50 border-slate-200 text-indigo-600'
                    }`}>
{`{
  "project_name": "API Visualizer Showcase",
  "github_profile_api_node": "https://api.github.com/users/octocat"
}`}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'js' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-amber-950/20 border-amber-900/40 text-amber-200' : 'bg-amber-50/50 border-amber-100 text-amber-800'
                  }`}>
                    <FileJson className="shrink-0 mt-0.5" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are JS Nodes?</span>
                      Keys ending in <code className="font-mono bg-amber-500/10 dark:bg-amber-500/20 px-1 py-0.5 rounded text-xs font-bold">_js_node</code> evaluate JavaScript code right from your graph! You can use them to calculate values, transform data, or build dynamic logic flows.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Code size={16} className="text-amber-500" />
                        <span>Interactive Editor</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        A fully featured Monaco Editor handles your JS execution. Your code defines the logic and state visually!
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Terminal size={16} className="text-emerald-500" />
                        <span>Console Output</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        When executed, it spawns a <code className="font-mono text-emerald-500">__js_terminal</code> child node to inspect returned data and standard output.
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold flex items-center gap-1.5 mb-2.5">
                      <Code size={16} className="text-amber-500" /> Defining a JS Node
                    </span>
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto border ${
                      appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
{`{
  "project_name": "JS execution",
  "math_calc_js_node": "const result = 50 * 20;\\nconsole.log('Result:', result);\\nconsole.log('namaste');"
}`}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'ts' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-blue-950/20 border-blue-900/40 text-blue-200' : 'bg-blue-50/50 border-blue-100 text-blue-800'
                  }`}>
                    <Code className="shrink-0 mt-0.5" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are TS Nodes?</span>
                      Keys ending in <code className="font-mono bg-blue-500/10 dark:bg-blue-500/20 px-1 py-0.5 rounded text-xs font-bold">_ts_node</code> securely compile and evaluate TypeScript code. Add full type safety and modern JS standards!
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <CheckCircle2 size={16} className="text-blue-500" />
                        <span>Type-safety & Intellisense</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enjoy rich semantic highlighting, TS compiler checks, and inline-error rendering via Monaco.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Play size={16} className="text-emerald-500" />
                        <span>Compiled Output</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Code gets transformed on the fly and spawns a <code className="font-mono text-emerald-500">__ts_terminal</code> child node to inspect returned values.
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold flex items-center gap-1.5 mb-2.5">
                      <Code size={16} className="text-blue-500" /> Defining a TS Node
                    </span>
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto border ${
                      appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
{`{
  "project_name": "TS execution",
  "greet_ts_node": "const msg: string = 'Typescript Rules';\\nconsole.log(msg);\\nconsole.log('namaste');"
}`}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'py' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200' : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                  }`}>
                    <Terminal className="shrink-0 mt-0.5 text-emerald-500" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are Python Nodes?</span>
                      Keys ending in <code className="font-mono bg-emerald-500/10 dark:bg-emerald-500/20 px-1 py-0.5 rounded text-xs font-bold">_py_node</code> run real Python code securely in your browser using Pyodide! Add data science, analysis, or general python logic seamlessly.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Code size={16} className="text-emerald-500" />
                        <span>Pyodide Sandbox</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Full Python runtime running right in the browser. You can use standard prints, write functions, import libraries, and access input data.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Terminal size={16} className="text-emerald-550" />
                        <span>Console Output</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        When executed, it logs outputs live under a <code className="font-mono text-emerald-500">__py_terminal</code> child node, with the final returned output mapped into the graph.
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold flex items-center gap-1.5 mb-2.5">
                      <Code size={16} className="text-emerald-500" /> Defining a Python Node
                    </span>
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto border ${
                      appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-emerald-300' : 'bg-[#f0fdf4] border-emerald-100 text-emerald-700'
                    }`}>
{`{
  "project_name": "Python execution",
  "greet_py_node": "text = 'Python Rules'\\nprint(text)\\nresult = {'message': text}\\nresult"
}`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Interactive Demo callout */}
              <div className={`p-4 mt-6 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                appTheme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <h4 className="font-semibold text-xs mb-1 uppercase tracking-wider text-slate-500 dark:text-slate-400">Try it out now!</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Insert interactive smart nodes into your current workspace.
                  </p>
                </div>
                <button
                  onClick={handleInsertExample}
                  className="flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-colors self-start sm:self-auto shadow-md shadow-indigo-500/10 active:scale-95 whitespace-nowrap"
                >
                  <Plus size={14} /> Inject Demo Nodes
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 bg-slate-50/50 dark:bg-slate-900/40 border-t flex justify-end gap-3 ${
              appTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <button
                onClick={onClose}
                className={`px-4 py-2 border rounded-lg text-xs font-semibold transition-colors ${
                  appTheme === 'dark' 
                    ? 'border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100' 
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default NodeHelpModal;
