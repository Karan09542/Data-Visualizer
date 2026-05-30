import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Network, Globe, Play, Edit, HelpCircle, Code, Plus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ApiNodeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiNodeHelpModal: React.FC<ApiNodeHelpModalProps> = ({ isOpen, onClose }) => {
  const { code, setCode, appTheme } = useStore();

  const handleInsertExample = async () => {
    try {
      const { parsedData, codeFormat, setCode, setCodeFormat } = useStore.getState();

      const demoFields = {
        demo_user_info: "Demographic and details panel",
        github_profile_api_node: "https://api.github.com/users/octocat",
        posts_api_node: "https://jsonplaceholder.typicode.com/posts/1",
        ip_lookup_api_node: "https://ipapi.co/json/"
      };

      const demoNodes = {
        demo_user_info: "Demographic and details panel",
        github_profile_api_node: "https://api.github.com/users/octocat",
        posts_api_node: "https://jsonplaceholder.typicode.com/posts/1",
        meta: {
          api_status: "online",
          ip_lookup_api_node: "https://ipapi.co/json/"
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
          project_name: "API Visualizer Showcase",
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

  return (
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
            <div className={`flex items-center justify-between p-4 border-b ${
              appTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Network className="text-indigo-500" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Dynamic API Nodes Guide</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Reactive Remote Integrations</p>
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

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-6 text-sm">
              <div className={`p-4 rounded-xl border flex gap-3 ${
                appTheme === 'dark' ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-200' : 'bg-indigo-50/50 border-indigo-100 text-indigo-700'
              }`}>
                <Globe className="shrink-0 mt-0.5" size={18} />
                <div>
                  <span className="font-semibold block mb-0.5">What are API Nodes?</span>
                  If any JSON/YAML key ends with the suffix <code className="font-mono bg-indigo-500/10 dark:bg-indigo-500/20 px-1 py-0.5 rounded text-xs font-bold">_api_node</code> and contains a String URL value, this tool turns that key into an interactive, clickable API endpoint directly inside your graph view!
                </div>
              </div>

              {/* Steps/Features grid */}
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
                    <Play size={16} className="text-emerald-500 animate-pulse" />
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

              {/* Code Example */}
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
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <ArrowRight size={12} className="text-indigo-500" />
                  <span>The custom visualizer automatically spawns UI panels to load the endpoint</span>
                </div>
              </div>

              {/* Interactive Demo callout */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                appTheme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <h4 className="font-semibold text-xs mb-1 uppercase tracking-wider text-slate-500 dark:text-slate-400">Try it out now!</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Insert interactive API node nodes into your current JSON view workspace.
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
    </AnimatePresence>
  );
};

export default ApiNodeHelpModal;
