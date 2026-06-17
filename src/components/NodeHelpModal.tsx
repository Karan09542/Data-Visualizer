import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Network, Globe, Play, Edit, HelpCircle, Code, Plus, CheckCircle2, FileJson, Terminal, ListTodo, Calculator, Settings, Bookmark, Crosshair, Image as ImageIcon, Layers, Search, BookOpen, Share2 } from 'lucide-react';
import { useStore } from '../store/useStore';

interface NodeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NodeHelpModal: React.FC<NodeHelpModalProps> = ({ isOpen, onClose }) => {
  const { code, setCode, appTheme } = useStore();
  const [activeTab, setActiveTab] = useState<'api' | 'js' | 'ts' | 'py' | 'math' | 'todo' | 'image' | 'search' | 'transfer'>('api');

  const handleInsertExample = async () => {
    try {
      const { parsedData, codeFormat, setCode, setCodeFormat } = useStore.getState();

      const demoFields = {
        demo_user_info: "Demographic and details panel",
        github_profile_api_node: "https://api.github.com/users/octocat",
        posts_api_node: "https://jsonplaceholder.typicode.com/posts/1",
        ip_lookup_api_node: "https://ipapi.co/json/",
        calculator_js_node: "// JS calculation node executing!\n// namaste",
        greeting_ts_node: "const name: string = 'World';\n// Hello ${name}!\n// namaste",
        greeting_py_node: 'text = "World"\nprint(f"Hello {text}!")\nprint("namaste")',
        waveform_math_node: "f(x) = a * sin(b * x + c)",
        "demo_asset.image": "https://images.unsplash.com/photo-1542393545-10f5cde2c810?q=80&w=600&auto=format&fit=crop",
        "sync_assets.transfer": "",
        "project_tasks.todo": JSON.stringify({
          title: "Project Tasks",
          tasks: [
            { id: "dt1", text: "Design Database Schema", completed: true, status: "Completed", priority: "High" },
            { 
              id: "dt2", 
              text: "Setup Authentication Flow", 
              completed: false, 
              status: "Todo", 
              priority: "High",
              tasks: [
                { id: "dt2-1", text: "Integrate OAuth Callback", completed: true, status: "Completed", priority: "Medium" },
                { id: "dt2-2", text: "Validate Session Tokens", completed: false, status: "Todo", priority: "High" }
              ]
            },
            { id: "dt3", text: "Write API endpoints & tests", completed: false, status: "Todo", priority: "Low" }
          ]
        }, null, 2)
      };

      const demoNodes = {
        demo_user_info: "Demographic and details panel",
        github_profile_api_node: "https://api.github.com/users/octocat",
        posts_api_node: "https://jsonplaceholder.typicode.com/posts/1",
        meta: {
          api_status: "online",
          ip_lookup_api_node: "https://ipapi.co/json/",
          run_calc_js_node: "// Math calculation:\n// namaste",
          format_date_ts_node: "// Current ISO Date:\n// namaste",
          greeting_py_node: 'text = "World"\nprint(f"Hello {text}!")\nprint("namaste")',
          waveform_math_node: "f(x) = a * sin(b * x + c)",
          "demo_asset.image": "https://images.unsplash.com/photo-1542393545-10f5cde2c810?q=80&w=600&auto=format&fit=crop",
          "specs_transfer_node": "",
          "project_tasks.todo": JSON.stringify({
            title: "Project Tasks",
            tasks: [
              { id: "dt1", text: "Design Database Schema", completed: true, status: "Completed", priority: "High" },
              { 
                id: "dt2", 
                text: "Setup Authentication Flow", 
                completed: false, 
                status: "Todo", 
                priority: "High",
                tasks: [
                  { id: "dt2-1", text: "Integrate OAuth Callback", completed: true, status: "Completed", priority: "Medium" },
                  { id: "dt2-2", text: "Validate Session Tokens", completed: false, status: "Todo", priority: "High" }
                ]
              },
              { id: "dt3", text: "Write API endpoints & tests", completed: false, status: "Todo", priority: "Low" }
            ]
          }, null, 2)
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
              <div className="px-4 border-b dark:border-slate-800/50">
                <div className="flex gap-2 overflow-x-auto scrollbar-none py-2 shrink-0 min-w-0 max-w-full">
                  {([
                    { id: 'api', label: 'API Nodes', icon: Network, color: 'indigo' },
                    { id: 'js', label: 'JS Nodes', icon: FileJson, color: 'amber' },
                    { id: 'ts', label: 'TS Nodes', icon: Code, color: 'blue' },
                    { id: 'py', label: 'Python Nodes', icon: Terminal, color: 'emerald' },
                    { id: 'search', label: 'Search Nodes', icon: Search, color: 'blue' },
                    { id: 'math', label: 'Math Nodes', icon: Calculator, color: 'rose' },
                    { id: 'todo', label: 'Todo Nodes', icon: ListTodo, color: 'purple' },
                    { id: 'image', label: 'Image Nodes', icon: ImageIcon, color: 'cyan' },
                    { id: 'transfer', label: 'Transfer Nodes', icon: Share2, color: 'indigo' },
                  ] as const).map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                          isActive
                            ? tab.color === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                              : tab.color === 'amber' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                              : tab.color === 'blue' ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                              : tab.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                              : tab.color === 'rose' ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-450 font-bold shadow-xs'
                              : tab.color === 'cyan' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs'
                              : 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-bold shadow-xs'
                            : 'bg-slate-50/50 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <Icon size={14} className={isActive ? 'opacity-100' : 'opacity-70'} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-none space-y-6 text-sm">
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
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto scrollbar-none border ${
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
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto scrollbar-none border ${
                      appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
{`{
  "project_name": "JS execution",
  "math_calc_js_node": "const result = 50 * 20;\\n// Result: result\\n// namaste"
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
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto scrollbar-none border ${
                      appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
{`{
  "project_name": "TS execution",
  "greet_ts_node": "const msg: string = 'Typescript Rules';\\n// msg\\n// namaste"
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
                        <Terminal size={16} className="text-emerald-555" />
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
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto scrollbar-none border ${
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

              {activeTab === 'math' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-rose-950/20 border-rose-900/40 text-rose-200' : 'bg-rose-50/50 border-rose-100 text-rose-850'
                  }`}>
                    <Calculator className="shrink-0 mt-0.5 text-rose-500" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are Math Nodes?</span>
                      Keys or files ending with either <code className="font-mono bg-rose-500/10 dark:bg-rose-500/20 px-1 py-0.5 rounded text-xs font-bold">.math</code> or <code className="font-mono bg-rose-500/10 dark:bg-rose-500/20 px-1 py-0.5 rounded text-xs font-bold">_math_node</code> evaluate advanced math equations and plot functions dynamically in an interactive coordinate visualizer!
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Crosshair size={16} className="text-rose-555" />
                        <span>Interactive Coordinate Grid</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Visualize coordinate plots like Cartesian, polar coordinates, and parametric curves using our interactive graphing stage. Enjoy rich fluid pan, zoom, and live point manipulation.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Settings size={16} className="text-rose-555" />
                        <span>Dynamic Slider Controls</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Declare slider variables like <code className="font-mono">a</code>, <code className="font-mono">b</code> or <code className="font-mono">k</code>. Watch your functions, derivatives, tangents and shapes update instantly as you shift boundaries.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Bookmark size={16} className="text-rose-555" />
                        <span>Matrix / Vector Math</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Solve equations, define matrices (<code className="font-mono">[[1, 2], [3, 4]]</code>), compute determinants, plot vectors, draw polygons, and analyze transformations right in your workspace.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Plus size={16} className="text-rose-555" />
                        <span>KaTeX & Typeset Notation</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Your custom equations, matrices, and variables are automatically parsed and formatted into textbook mathematical print via beautiful KaTeX typeset.
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold flex items-center gap-1.5 mb-2.5">
                      <Code size={16} className="text-rose-555" /> Defining a Math Node in JSON
                    </span>
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto scrollbar-none border ${
                      appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}>
{`{
  "project_name": "Calculus and Algebra Nodes",
  "sine_oscillations_math_node": "f(x) = a * sin(b * x + c)",
  "archimedean_spiral.math": "r = theta * k"
}`}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'todo' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-purple-950/20 border-purple-900/40 text-purple-200' : 'bg-purple-50/50 border-purple-100 text-purple-850'
                  }`}>
                    <ListTodo className="shrink-0 mt-0.5 text-purple-500" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are Todo Nodes?</span>
                      Keys or files ending with either <code className="font-mono bg-purple-500/10 dark:bg-purple-500/20 px-1 py-0.5 rounded text-xs font-bold">.todo</code> or <code className="font-mono bg-purple-500/10 dark:bg-purple-500/20 px-1 py-0.5 rounded text-xs font-bold">_todo_node</code> render fully interactive checklists directly in your workspace graphs! Use them to manage priorities, project tasks, and roadmap items.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <CheckCircle2 size={16} className="text-purple-500" />
                        <span>Interactive Nesting & Tree</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Todo Nodes dynamically support nested hierarchies. You can expand/collapse sections and view interactive indicators mapping out your milestones.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Play size={16} className="text-purple-500" />
                        <span>Smart Checks Propagation</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Checking a parent item automatically sets checkboxes on all descendants recursively, while completing all sub-tasks auto-completes parent milestones.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Edit size={16} className="text-purple-500" />
                        <span>Rename & Priority Cycling</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Double-click any list item text (or click the edit button) to rename it. Click the priority pill to cycle weights (<span className="text-rose-500 font-semibold">High</span> → <span className="text-amber-500 font-semibold">Medium</span> → <span className="text-blue-500 font-semibold">Low</span>).
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Plus size={16} className="text-purple-500" />
                        <span>Creation & Deletion</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Quickly add new items or nested sub-tasks from raw input fields, and easily remove items with instant synchronization across views and persistent code.
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="font-bold flex items-center gap-1.5 mb-2.5">
                      <Code size={16} className="text-purple-500" /> Defining a Todo Node
                    </span>
                    <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto scrollbar-none border ${
                      appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-purple-300' : 'bg-purple-50/30 border-purple-100 text-purple-700'
                    }`}>
{`{
  "title": "Project Deliverables",
  "tasks": [
    {
      "id": "t1",
      "text": "Task Name",
      "completed": false,
      "priority": "High"
    }
  ]
}`}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'search' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-blue-950/20 border-blue-900/40 text-blue-200' : 'bg-blue-50/50 border-blue-100 text-blue-850'
                  }`}>
                    <Search className="shrink-0 mt-0.5 text-blue-500" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are Search Nodes?</span>
                      Keys or files ending with either <code className="font-mono bg-blue-500/10 dark:bg-blue-500/20 px-1 py-0.5 rounded text-xs font-bold">.search</code> or <code className="font-mono bg-blue-500/10 dark:bg-blue-500/20 px-1 py-0.5 rounded text-xs font-bold">_search_node</code> act as built-in search engines inside the application. They support searching topics, fetching summaries, discovering images, and reading full articles via Wikipedia.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <BookOpen size={16} className="text-blue-500" />
                        <span>Full Articles & Images</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Launch a beautiful full-screen reading experience with inline articles, image viewing, categories, and direct Wikipedia linking — no need to leave your workspace.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Bookmark size={16} className="text-blue-500" />
                        <span>Rich Output & History</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Searches log queries safely in your local history, support favorites, and push rich metadata (images, summaries) back to their JSON object parent automatically.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'image' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-cyan-950/20 border-cyan-900/40 text-cyan-200' : 'bg-cyan-50/50 border-cyan-100 text-cyan-850'
                  }`}>
                    <ImageIcon className="shrink-0 mt-0.5 text-cyan-500" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are Image Nodes?</span>
                      Keys or files ending with either <code className="font-mono bg-cyan-500/10 dark:bg-cyan-500/20 px-1 py-0.5 rounded text-xs font-bold">.image</code>, <code className="font-mono bg-cyan-500/10 dark:bg-cyan-500/20 px-1 py-0.5 rounded text-xs font-bold">.png</code>, <code className="font-mono bg-cyan-500/10 dark:bg-cyan-500/20 px-1 py-0.5 rounded text-xs font-bold">.jpg</code>, or <code className="font-mono bg-cyan-500/10 dark:bg-cyan-500/20 px-1 py-0.5 rounded text-xs font-bold">_image_node</code> render rich, interactive image editing workspaces. Use them to draw, add shapes, resize, apply filters, and manipulate visual assets directly in your graph!
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Edit className="text-cyan-500" size={16} />
                        <span>Interactive Editing Toolset</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enjoy a full suite of image editing tools: crop, pan, draw with customizable brushes, insert text, shapes, and apply filters non-destructively.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Layers size={16} className="text-cyan-500" />
                        <span>Layers & Artboards</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Organize your creative workflow with multiple artboards and deep layer management supporting reordering, visibility toggling, and object locking.
                        <br/><br/>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">Shortcuts: </span>
                        Use <code className="font-mono text-[10px] bg-slate-800/10 dark:bg-slate-800/50 px-1 rounded border border-slate-300 dark:border-slate-700/50">Ctrl+[</code> / <code className="font-mono text-[10px] bg-slate-800/10 dark:bg-slate-800/50 px-1 rounded border border-slate-300 dark:border-slate-700/50">Ctrl+]</code> to Send Backward/Bring Forward. Add <code className="font-mono text-[10px] bg-slate-800/10 dark:bg-slate-800/50 px-1 rounded border border-slate-300 dark:border-slate-700/50">Shift</code> to Send to Back/Bring to Front.
                      </p>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-[#0d1117] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                     <span className="font-bold flex items-center gap-1.5 mb-2.5">
                       <Code size={16} className="text-cyan-500" /> Defining an Image Node
                     </span>
                     <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto scrollbar-none border ${
                       appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-cyan-300' : 'bg-cyan-50/30 border-cyan-100 text-cyan-700'
                     }`}>
{`{
  "src": "https://example.com/image.png",
  "alt": "An example image",
  "filters": ["grayscale"],
  "annotations": []
}`}
                     </pre>
                  </div>
                </div>
              )}

              {activeTab === 'transfer' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-4 rounded-xl border flex gap-3 ${
                    appTheme === 'dark' ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-200' : 'bg-indigo-50/50 border-indigo-100 text-indigo-800'
                  }`}>
                    <Share2 className="shrink-0 mt-0.5 text-indigo-500" size={18} />
                    <div>
                      <span className="font-semibold block mb-0.5">What are Transfer Nodes?</span>
                      Keys or files ending with either <code className="font-mono bg-indigo-500/10 dark:bg-indigo-500/20 px-1 py-0.5 rounded text-xs font-bold">.transfer</code> or <code className="font-mono bg-indigo-500/10 dark:bg-indigo-500/20 px-1 py-0.5 rounded text-xs font-bold">_transfer_node</code> render elegant, full-featured peer-to-peer (P2P) file transfer hubs directly inside your network graph!
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Share2 className="text-indigo-500" size={16} />
                        <span>Direct P2P WebRTC Tech</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                        Leverage real-time browser-to-browser data channels to send or sync custom binaries, project files, and system resources securely with zero server-side storage overhead.
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Bookmark className="text-indigo-500" size={16} />
                        <span>Live Diagnostics Panel</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                        Keep full sight over operations with detailed metrics like live file transfer speeds, real-time diagnostic reports, connection handshakes, and elegant precise progress indicators.
                      </p>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${appTheme === 'dark' ? 'bg-[#0d1117] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                     <span className="font-bold flex items-center gap-1.5 mb-2.5">
                       <Code size={16} className="text-indigo-500" /> Defining a Transfer Node
                     </span>
                     <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto scrollbar-none border ${
                       appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-indigo-300' : 'bg-indigo-50/30 border-indigo-100 text-indigo-700'
                     }`}>
{`{
  "project_resources": {
    "specs_transfer_node": "",
    "backup_database.transfer": ""
  }
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
