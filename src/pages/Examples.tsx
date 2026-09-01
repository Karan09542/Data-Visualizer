import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, CodeFormat } from '../store/useStore';
import {
  Play,
  Copy,
  Check,
  LayoutTemplate,
  ArrowRight,
  Search,
  Terminal,
  Radio,
  Calculator,
  Share2,
  ListTodo,
  Server,
  Layers,
  Sparkles,
  Filter,
  FileText,
  X
} from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';

type CategoryType = 'all' | 'interactive' | 'api_code' | 'data_config';

interface ExampleItem {
  id: string;
  title: string;
  category: CategoryType;
  categoryLabel: string;
  description: string;
  format: CodeFormat;
  tags: string[];
  icon: React.ReactNode;
  data: string;
}

const EXAMPLES: ExampleItem[] = [
  {
    id: "live-api",
    title: "Live Crypto & Weather REST APIs",
    category: "api_code",
    categoryLabel: "Live APIs",
    description: "Interactive REST API endpoints in the graph. Click Send Request right on the node to query live data and expand child branches.",
    format: "json",
    tags: ["REST API", "Live Fetch", "JSON"],
    icon: <Radio className="w-5 h-5 text-blue-500" />,
    data: `{
  "workspace": "Live API Explorer",
  "environment": "production",
  "crypto_market.api": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd",
  "weather_berlin.api": "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true",
  "metadata": {
    "refresh_rate_seconds": 60,
    "cors_mode": "browser_fetch"
  }
}`
  },
  {
    id: "python-sandbox",
    title: "Python Data Analysis Sandbox",
    category: "api_code",
    categoryLabel: "Code Sandbox",
    description: "Client-side Python runtime powered by Pyodide WebAssembly. Run computations, inspect variables, and view console output.",
    format: "json",
    tags: ["Python", "WebAssembly", "Statistics"],
    icon: <Terminal className="w-5 h-5 text-emerald-500" />,
    data: `{
  "experiment": "Dataset Variance & Distribution",
  "author": "Data Team",
  "statistical_analysis.py": "import math\\n\\ndata = [12, 45, 67, 89, 34, 22, 90, 54, 76, 43]\\nmean = sum(data) / len(data)\\nvariance = sum((x - mean) ** 2 for x in data) / len(data)\\nstd_dev = math.sqrt(variance)\\n\\nprint(f'Observations: {len(data)}')\\nprint(f'Mean: {mean:.2f}')\\nprint(f'Variance: {variance:.2f}')\\nprint(f'Standard Deviation: {std_dev:.2f}')",
  "parameters": {
    "sample_size": 10,
    "confidence_level": 0.95
  }
}`
  },
  {
    id: "math-grapher",
    title: "Dynamic Math & Harmonic Plotter",
    category: "interactive",
    categoryLabel: "Interactive Math",
    description: "Mafs-powered mathematical grapher with parametric functions, wave harmonics, and interactive variable sliders.",
    format: "json",
    tags: ["Math", "Calculus", "Plotting"],
    icon: <Calculator className="w-5 h-5 text-fuchsia-500" />,
    data: `{
  "topic": "Fourier Wave Superposition",
  "wave_harmonics.math": {
    "functions": [
      {
        "id": "f1",
        "expr": "sin(x) + 0.5 * sin(3 * x)",
        "color": "#6366f1",
        "visible": true,
        "type": "function"
      },
      {
        "id": "f2",
        "expr": "cos(x * 1.5)",
        "color": "#06b6d4",
        "visible": true,
        "type": "function"
      }
    ],
    "variables": [
      {
        "id": "v1",
        "name": "a",
        "value": 1.5,
        "min": 0,
        "max": 5,
        "step": 0.1
      }
    ]
  },
  "notes": "Harmonic oscillation with fundamental frequency and 3rd harmonic."
}`
  },
  {
    id: "webrtc-transfer",
    title: "WebRTC Peer-to-Peer Transfer",
    category: "interactive",
    categoryLabel: "P2P WebRTC",
    description: "Direct browser-to-browser encrypted file & message sharing with QR pairing, zero intermediate server storage, and stream-to-disk transfers.",
    format: "json",
    tags: ["WebRTC", "Encrypted", "Zero-Server"],
    icon: <Share2 className="w-5 h-5 text-cyan-500" />,
    data: `{
  "session_title": "Direct Device Transfer",
  "secure_file_share_transfer_node": "session_ready",
  "transfer_policy": {
    "encryption": "AES-GCM-256",
    "protocol": "WebRTC DataChannel",
    "direct_p2p": true,
    "zero_server_storage": true
  }
}`
  },
  {
    id: "kanban-board",
    title: "Embedded Sprint & Task Board",
    category: "interactive",
    categoryLabel: "Productivity",
    description: "Interactive Kanban task management node embedded right inside the data graph with status columns, priorities, and tags.",
    format: "json",
    tags: ["Kanban", "Todo", "Tasks"],
    icon: <ListTodo className="w-5 h-5 text-amber-500" />,
    data: `{
  "project": "Data Visualizer v3.0",
  "sprint_backlog.todo": {
    "title": "Release Sprint 4",
    "tasks": [
      {
        "id": "t1",
        "text": "Optimize WebAssembly Pyodide package caching",
        "completed": true,
        "status": "Completed",
        "priority": "High",
        "tags": ["wasm", "performance"]
      },
      {
        "id": "t2",
        "text": "Enhance WebRTC stream-to-disk large file transfers",
        "completed": false,
        "status": "In Progress",
        "priority": "Critical",
        "tags": ["webrtc", "networking"]
      },
      {
        "id": "t3",
        "text": "Multi-photo Passport Studio grid generator",
        "completed": true,
        "status": "Completed",
        "priority": "Normal",
        "tags": ["studio"]
      }
    ]
  }
}`
  },
  {
    id: "cloud-architecture",
    title: "Cloud Microservices Architecture",
    category: "data_config",
    categoryLabel: "Complex Data",
    description: "Deeply nested JSON structure representing cloud infrastructure, active regions, service mesh metrics, and databases.",
    format: "json",
    tags: ["Microservices", "JSON Hierarchy", "DevOps"],
    icon: <Server className="w-5 h-5 text-indigo-500" />,
    data: `{
  "cluster": {
    "id": "prod-us-east-1",
    "status": "healthy",
    "uptime_pct": 99.98,
    "services": [
      {
        "name": "auth-service",
        "replicas": 4,
        "latency_ms": 18,
        "endpoints": ["/api/v1/login", "/api/v1/oauth"],
        "telemetry": { "qps": 1240, "error_rate": 0.001 }
      },
      {
        "name": "visualizer-gateway",
        "replicas": 6,
        "latency_ms": 12,
        "endpoints": ["/ws/p2p-signal", "/api/v2/parse"],
        "telemetry": { "qps": 3400, "error_rate": 0.0004 }
      }
    ],
    "storage": {
      "primary_db": "PostgreSQL 16 HA",
      "cache_nodes": 3,
      "encrypted_at_rest": true
    }
  }
}`
  },
  {
    id: "kubernetes-yaml",
    title: "Kubernetes Deployment & Ingress",
    category: "data_config",
    categoryLabel: "DevOps Config",
    description: "Standard multi-container deployment specification in YAML with volume claims, ingress rules, and container resources.",
    format: "yaml",
    tags: ["Kubernetes", "YAML", "Infrastructure"],
    icon: <FileText className="w-5 h-5 text-emerald-500" />,
    data: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: visualizer-app
  labels:
    tier: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: visualizer
  template:
    metadata:
      labels:
        app: visualizer
    spec:
      containers:
        - name: web
          image: visualizer:latest
          ports:
            - containerPort: 3000
          resources:
            limits:
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: visualizer-svc
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000`
  },
  {
    id: "media-assets",
    title: "3D Models, PDF & Media Assets",
    category: "data_config",
    categoryLabel: "Rich Media",
    description: "Interactive dataset showcasing in-canvas 3D models (.glb), PDF documents with rotation/zoom, audio, and high-res image previews.",
    format: "json",
    tags: ["3D GLB", "PDF Viewer", "Media"],
    icon: <Layers className="w-5 h-5 text-violet-500" />,
    data: `{
  "project_media_manifest": {
    "3d_showcase": {
      "model_name": "Astronaut Model",
      "model_preview_glb": "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
      "format": "glTF 2.0 Binary"
    },
    "documents": {
      "architecture_spec": "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf",
      "type": "PDF Document"
    },
    "gallery": [
      { "label": "Landscape", "url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb" },
      { "label": "Architecture", "url": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab" }
    ]
  }
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
    <div className="relative group overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1117]">
      <div className="absolute top-2.5 right-2.5 opacity-90 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1.5">
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-200/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 rounded-md backdrop-blur-sm shadow-xs">
          {format}
        </span>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg bg-white/90 dark:bg-[#161b22]/90 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200/80 dark:border-slate-700 transition-all active:scale-90"
          title="Copy code snippet"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
      </div>
      <div className="overflow-auto h-56 custom-scrollbar text-xs">
        <Highlight theme={theme} code={code} language={format as any}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} p-3.5 m-0 min-h-full font-mono text-[12px] leading-relaxed select-text`}
              style={{ ...style, backgroundColor: 'transparent' }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="table-row">
                  <span className="table-cell text-right pr-3 select-none opacity-30 text-[10px] font-mono sticky left-[-0.5rem] bg-slate-50 dark:bg-[#0d1117] pl-1">
                    {i + 1}
                  </span>
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

  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = "Examples & Templates | Data Visualizer";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Explore interactive examples of Data Visualizer: Live REST API nodes, client-side Python execution, WebRTC P2P transfers, dynamic math graphs, and Kanban boards."
      );
    }

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

  const filteredExamples = useMemo(() => {
    return EXAMPLES.filter(item => {
      const matchesCategory =
        selectedCategory === 'all' ||
        item.category === selectedCategory ||
        (selectedCategory === 'interactive' && (item.category === 'interactive' || item.category === 'api_code'));

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(t => t.toLowerCase().includes(query)) ||
        item.categoryLabel.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const categories: { id: CategoryType; label: string; count: number }[] = [
    { id: 'all', label: 'All Templates', count: EXAMPLES.length },
    { id: 'interactive', label: 'Interactive Nodes', count: EXAMPLES.filter(e => e.category === 'interactive' || e.category === 'api_code').length },
    { id: 'api_code', label: 'APIs & Sandboxes', count: EXAMPLES.filter(e => e.category === 'api_code').length },
    { id: 'data_config', label: 'Data & Configs', count: EXAMPLES.filter(e => e.category === 'data_config').length },
  ];

  return (
    <div className="max-w-6xl mx-auto py-4 px-2 sm:px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-6 shadow-sm">
          <Sparkles size={14} className="text-indigo-500" />
          Interactive Workspace Gallery
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-5 leading-tight">
          Ready-to-Use{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">
            Interactive Templates
          </span>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
          Choose any template below to immediately launch it in the workspace. Test live API nodes, client-side Python execution, math graphers, P2P file transfers, or nested data structures.
        </p>
      </section>

      {/* Filter and Search Bar */}
      <section className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Scrollable Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-2 px-2 sm:mx-0 sm:px-0">
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                    : 'bg-white dark:bg-[#161b22] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected
                      ? 'bg-indigo-700/90 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search templates or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-xs transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </section>

      {/* Templates Grid */}
      {filteredExamples.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#161b22] rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
          <Filter size={32} className="mx-auto text-slate-400 mb-3 opacity-60" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">No matching templates</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Try adjusting your search query or switching categories.</p>
          <button
            onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
            className="px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredExamples.map((example) => (
            <div
              key={example.id}
              className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/50 group"
            >
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700/60 shrink-0">
                        {example.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                          {example.title}
                        </h2>
                        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {example.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                      {example.format}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                    {example.description}
                  </p>
                </div>

                <div>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {example.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Code Preview */}
                  <CodePreview code={example.data} format={example.format} appTheme={appTheme} />
                </div>
              </div>

              {/* Card Footer with CTA */}
              <div className="bg-slate-50/70 dark:bg-[#0f141a]/60 px-6 py-3.5 flex justify-between items-center border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Ready to run
                </span>
                <button
                  onClick={() => loadExample(example.data, example.format)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl shadow-xs transition-all text-xs flex items-center gap-1.5 active:scale-95 group-hover:scale-102"
                >
                  <Play size={13} className="fill-white" />
                  <span>View in Workspace</span>
                  <ArrowRight size={13} className="opacity-80" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Information Callout */}
      <section className="mt-16 p-8 bg-gradient-to-r from-indigo-500/10 via-slate-100/50 to-cyan-500/10 dark:from-indigo-950/30 dark:via-slate-900/40 dark:to-cyan-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-3xl text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Have your own dataset?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
            You can paste any custom JSON, YAML, or CSV directly into the editor, drag & drop files, or connect your own REST endpoints and Python scripts.
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm active:scale-95 transition-all"
          >
            <LayoutTemplate size={15} />
            <span>Open Blank Workspace</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

    </div>
  );
}
