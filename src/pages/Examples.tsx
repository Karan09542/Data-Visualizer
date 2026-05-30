import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, CodeFormat } from '../store/useStore';
import { Play, Copy, Check } from 'lucide-react';
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
      - NODE_ENV=production
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
    <div className="max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">Interactive Examples</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
        Select from the templates below to quickly load sample files into the visual workspace.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {EXAMPLES.map((example, idx) => (
          <div key={idx} className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col transition-shadow hover:shadow-md">
            <div className="p-6 flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">{example.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{example.description}</p>
              
              <CodePreview code={example.data} format={example.format} appTheme={appTheme} />
            </div>
            
            <div className="bg-slate-50 dark:bg-[#0f141a] px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => loadExample(example.data, example.format)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
              >
                <Play size={16} className="fill-white" />
                View in Editor
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
