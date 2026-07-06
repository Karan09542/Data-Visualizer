import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, CodeFormat } from '../store/useStore';
import { Play, Copy, Check, LayoutTemplate, ArrowRight, Share2 } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';

const EXAMPLES: Array<{ title: string, description: string, format: CodeFormat, data: string }> = [
  {
    title: "Nested JSON Example",
    description: "A complex, deep JSON object structured with arrays, nulls, and nested entities.",
    format: "json",
    data: `{
  "company": {
    "name": "TechFlow Inc.",
    "founded": 2021,
    "active": true,
    "employees": [
      {
        "id": 1,
        "name": "Alice Smith",
        "role": "Engineer",
        "skills": ["React", "TypeScript", "Node.js"]
      },
      {
        "id": 2,
        "name": "Bob Jones",
        "role": "Designer",
        "skills": ["Figma", "CSS", null]
      }
    ],
    "metrics": {
      "q1_revenue": 1050000,
      "growth": 0.15
    }
  }
}`
  },
  {
    title: "GitHub API Response",
    description: "Sample metadata output typically received from the GitHub issues API.",
    format: "json",
    data: `[
  {
    "url": "https://api.github.com/repos/user/project/issues/1",
    "repository_url": "https://api.github.com/repos/user/project",
    "id": 102938475,
    "number": 1,
    "title": "Bug: Sidebar does not collapse on mobile",
    "user": {
      "login": "johndoe",
      "id": 12345,
      "avatar_url": "https://avatars.githubusercontent.com/u/12345?v=4"
    },
    "labels": [
      { "name": "bug", "color": "d73a4a" },
      { "name": "ui/ux", "color": "1d76db" }
    ],
    "state": "open",
    "comments": 3
  }
]`
  },
  {
    title: "YAML Configuration",
    description: "A standard Docker Compose or Kubernetes-style YAML setup.",
    format: "yaml",
    data: `version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
    environment:
      - NODE_ENV: production
    volumes:
      - ./src:/var/www/html
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secretpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:`
  },
  {
    title: "WebRTC File Sharing",
    description: "Structured metadata for a peer-to-peer file transfer session, including connection states and ICE candidates.",
    format: "json",
    data: `{
    "file_transfer_node": "bhole"
}`
  }
];

function CodePreview({ code, format, appTheme }: { code: string, format: string, appTheme: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const theme = appTheme === 'dark' ? themes.nightOwl : themes.github;

  return (
    <div className="relative group overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1117]">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded-md backdrop-blur-sm self-center mr-1">
          {format}
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-white/80 dark:bg-[#161b22]/80 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="overflow-auto h-64 custom-scrollbar text-sm">
        <Highlight theme={theme} code={code} language={format as any}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={`${className} p-4 m-0 min-h-full font-mono text-[13px] leading-relaxed`} style={{...style, backgroundColor: 'transparent'}}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="table-row">
                  <span className="table-cell text-right pr-4 select-none opacity-40 text-[11px] font-mono sticky left-[-1rem] bg-slate-50 dark:bg-[#0d1117] pl-1">{i + 1}</span>
                  <span className="table-cell whitespace-pre">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}

export default function Examples() {
  const navigate = useNavigate();
  const setCode = useStore(state => state.setCode);
  const setCodeFormat = useStore(state => state.setCodeFormat);
  const appTheme = useStore(state => state.appTheme);

  useEffect(() => {
    document.title = "Examples | Data Visualizer";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute("content", "Explore interactive examples of how Data Visualizer can represent JSON, YAML, CSV and more.");
    
    // OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", "Examples | Data Visualizer");
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", "https://datavisualizer.urlmediainspector.dev/examples");

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://datavisualizer.urlmediainspector.dev/examples");
  }, []);

  const loadExample = (data: string, format: CodeFormat) => {
    setCodeFormat(format);
    setCode(data);
    navigate('/');
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl mb-6">
          <LayoutTemplate className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
          Interactive <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Examples</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
          Select from the templates below to quickly load sample files into the visual workspace and see the engine in action.
        </p>
      </div>

      {/* WebRTC Info Section */}
      <div className="mb-16 p-8 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 dark:from-indigo-500/10 dark:to-cyan-500/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[2rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Share2 size={120} className="text-indigo-600 dark:text-indigo-400 rotate-12" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-16 h-16 shrink-0 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700">
            <Share2 size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">WebRTC P2P File Sharing</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              Experience ultra-secure, direct device-to-device transfers. Our visualizer uses WebRTC technology to share data and files without ever touching a server. All metadata and transfer states are fully observable within the workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">ENCRYPTED</div>
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-full">NO-SERVER</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {EXAMPLES.map((example, idx) => (
          <div key={idx} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col transition-all hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700/50 group">
            <div className="p-8 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{example.title}</h2>
                <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full">
                  {example.format}
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">{example.description}</p>
              
              <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800/60 shadow-inner">
                <CodePreview code={example.data} format={example.format} appTheme={appTheme} />
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-[#0f141a]/50 px-8 py-5 flex justify-between items-center border-t border-slate-100 dark:border-slate-800/60">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ready to explore</span>
              <button 
                onClick={() => loadExample(example.data, example.format)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2 group-hover:scale-105 active:scale-95"
              >
                <Play size={16} className="fill-white" />
                View in Workspace
                <ArrowRight size={16} className="ml-1 opacity-70" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
