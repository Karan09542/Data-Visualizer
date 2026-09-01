import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Network,
  Shield,
  Share2,
  Terminal,
  Calculator,
  Radio,
  Sparkles,
  Layers,
  Table,
  CheckCircle2,
  ArrowRight,
  Cpu,
  Lock,
  WifiOff,
  Sliders,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  Printer,
  FileStack,
  Scissors,
  Waves,
  Pipette,
  Key,
  Binary,
  Hash,
  Palette
} from 'lucide-react';

export default function About() {
  useEffect(() => {
    document.title = "About | Data Visualizer - Visual Developer Workspace & Execution Studio";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Data Visualizer is a 100% client-side developer studio for interactive node graphs, live REST API nodes, executable Python/JS sandboxes, WebRTC P2P sharing, and math modeling."
      );
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", "About | Data Visualizer");
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", "https://datavisualizer.urlmediainspector.dev/about");

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://datavisualizer.urlmediainspector.dev/about");
  }, []);

  const corePillars = [
    {
      icon: <Network className="w-6 h-6 text-indigo-500" />,
      badge: "D3 Engine & Physics",
      title: "Interactive Graph & Schema Canvas",
      description: "Transform complex JSON, YAML, and CSV datasets into intuitive visual trees. Switch between force, radial, mindmap, and schema modes with 50+ themes and custom edge styles."
    },
    {
      icon: <Terminal className="w-6 h-6 text-emerald-500" />,
      badge: "WebAssembly / Pyodide",
      title: "Executable Python & JS Sandboxes",
      description: "Execute Python (with NumPy, Pandas, Matplotlib) and TypeScript/JavaScript client-side directly within graph nodes. Inspect console outputs and plots in real time."
    },
    {
      icon: <Radio className="w-6 h-6 text-blue-500" />,
      badge: "Live HTTP Client",
      title: "Live REST API Nodes",
      description: "Embed live REST endpoints inside your graph. Test GET, POST, and PUT calls, monitor latency and status codes, and expand fetched responses into interactive node branches."
    },
    {
      icon: <Share2 className="w-6 h-6 text-cyan-500" />,
      badge: "Direct P2P",
      title: "WebRTC Encrypted File Transfer",
      description: "Share large files and messages directly between devices using QR pairing and WebRTC data channels. End-to-end encrypted with stream-to-disk capability and zero server storage."
    },
    {
      icon: <Calculator className="w-6 h-6 text-fuchsia-500" />,
      badge: "Mafs Interactive",
      title: "Dynamic Math & Calculus Grapher",
      description: "Plot mathematical equations, LaTeX formulas, parametric curves, and step-by-step calculus. Tweak variables with real-time interactive coordinate sliders and gizmos."
    },
    {
      icon: <Sparkles className="w-6 h-6 text-amber-500" />,
      badge: "Built-In Studio",
      title: "Developer Utilities & Media Engine",
      description: "Includes Passport Photo Studio, PDF viewer & merger, Image Slicer, 3D model viewer (.glb), Audio/Video player, Kanban task boards, JWT decoder, and cryptographic hash tools."
    }
  ];

  const architecturalGuarantees = [
    {
      icon: <Lock className="w-5 h-5 text-indigo-500" />,
      title: "100% Client-Side",
      desc: "Zero server storage. Your data, code, and files never leave your browser sandbox."
    },
    {
      icon: <Cpu className="w-5 h-5 text-emerald-500" />,
      title: "WebAssembly Power",
      desc: "Fast in-browser computing powered by Pyodide, D3, and dedicated Web Workers."
    },
    {
      icon: <WifiOff className="w-5 h-5 text-blue-500" />,
      title: "Offline & PWA Ready",
      desc: "Install as a desktop app with IndexedDB persistence, auto-save, and offline reliability."
    },
    {
      icon: <Sliders className="w-5 h-5 text-purple-500" />,
      title: "Zero Setup Required",
      desc: "No backend, API keys, or installation required. Open, paste, and start exploring immediately."
    }
  ];

  const perspectives = [
    {
      title: "Graph Canvas",
      icon: <Network className="w-5 h-5 text-indigo-500" />,
      tag: "Exploratory & Interactive",
      desc: "Fluid node-link graph with pan, zoom, collapsible branches, and 50+ styling presets. Best for visualizing deep hierarchies and connections."
    },
    {
      title: "Schema View",
      icon: <Layers className="w-5 h-5 text-emerald-500" />,
      tag: "Structural Summary",
      desc: "Distills massive datasets into clear architectural models displaying field types, cardinality, and schemas without UI clutter."
    },
    {
      title: "Table Mode",
      icon: <Table className="w-5 h-5 text-cyan-500" />,
      tag: "Tabular & High-Density",
      desc: "Converts nested arrays and datasets into responsive tabular grids for rapid scanning, filtering, and spreadsheet comparison."
    }
  ];

  const quickUtils = [
    { name: "Passport Studio", icon: <Printer className="w-4 h-4 text-blue-500" /> },
    { name: "Image to PDF", icon: <FileText className="w-4 h-4 text-sky-500" /> },
    { name: "Merge PDFs", icon: <FileStack className="w-4 h-4 text-indigo-500" /> },
    { name: "Image Slicer", icon: <Scissors className="w-4 h-4 text-orange-500" /> },
    { name: "Wave Studio", icon: <Waves className="w-4 h-4 text-cyan-500" /> },
    { name: "Color Thief", icon: <Pipette className="w-4 h-4 text-fuchsia-500" /> },
    { name: "JWT Decoder", icon: <Key className="w-4 h-4 text-amber-500" /> },
    { name: "Hash Generator", icon: <Hash className="w-4 h-4 text-red-500" /> },
    { name: "Base64 Utility", icon: <Binary className="w-4 h-4 text-emerald-500" /> },
    { name: "Color Converter", icon: <Palette className="w-4 h-4 text-pink-500" /> },
    { name: "CSV to JSON", icon: <FileSpreadsheet className="w-4 h-4 text-teal-500" /> },
    { name: "3D & PDF Viewer", icon: <FileCode className="w-4 h-4 text-violet-500" /> }
  ];

  return (
    <div className="max-w-5xl mx-auto py-4 px-2 sm:px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          All-in-One Visual Data & Developer Workspace
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
          Understand, Execute & Share Your Data,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500">
            Visually
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
          Data Visualizer transforms static JSON, YAML, and CSV files into living, executable canvas workspaces.
          Run Python & JavaScript client-side, query live REST APIs, transfer files P2P via encrypted WebRTC, and graph math formulas—100% in your browser.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all text-sm sm:text-base"
          >
            <span>Launch Workspace</span>
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/examples"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-[#161b22] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all text-sm sm:text-base"
          >
            <span>Browse Examples</span>
          </Link>
        </div>
      </section>

      {/* Architectural Guarantees Grid */}
      <section className="mb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {architecturalGuarantees.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white dark:bg-[#161b22] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-start gap-2.5 transition-all hover:border-indigo-300 dark:hover:border-indigo-700/50"
            >
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60">
                {item.icon}
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{item.title}</h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 6 Core Superpowers Grid */}
      <section className="mb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            Core Capabilities
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Far more than a simple JSON tree. An integrated visual operating system for modern developers and analysts.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {corePillars.map((pillar, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#161b22] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-700/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 bg-slate-50 dark:bg-slate-800/70 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-700/50">
                    {pillar.icon}
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                    {pillar.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {pillar.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4">
                  {pillar.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 Viewing Perspectives */}
      <section className="mb-20 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-cyan-50/50 dark:from-indigo-950/20 dark:via-[#161b22] dark:to-cyan-950/20 p-8 sm:p-10 rounded-3xl border border-indigo-100/80 dark:border-indigo-900/30">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
            Three Perspectives, One Workspace
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Switch views instantly depending on whether you need deep relationship mapping, high-level architecture, or tabular spreadsheet analysis.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {perspectives.map((p, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#11161d] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80">
                    {p.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-none">
                      {p.title}
                    </h3>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {p.tag}
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Built-in Developer Utilities Suite */}
      <section className="mb-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">
          Integrated Quick Utilities Studio
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
          A full suite of native micro-tools ready inside the workspace—no external websites or conversion services needed.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {quickUtils.map((util, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center p-4 bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                {util.icon}
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {util.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Security & Privacy Commitment */}
      <section className="mb-16 p-8 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
            <Shield className="w-7 h-7" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">
              Client-First Privacy & Zero-Knowledge Architecture
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Every parsing routine, Python calculation, WebRTC transfer, and image manipulation runs purely inside your browser sandbox. We never store, inspect, or transmit your proprietary data to remote servers.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200/50 dark:border-emerald-800/40 flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Zero Telemetry
            </span>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="text-center bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-10 sm:p-12 rounded-3xl shadow-xl shadow-indigo-500/10">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
          Ready to Explore Your Data?
        </h2>
        <p className="text-indigo-100 text-sm sm:text-base max-w-xl mx-auto mb-6 leading-relaxed">
          Open the workspace to paste your raw data, or jump straight into interactive pre-built templates.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-indigo-700 font-bold shadow-md text-sm active:scale-95 transition-all"
          >
            Open Workspace Now
          </Link>
          <Link
            to="/examples"
            className="px-6 py-3 rounded-xl bg-indigo-800/60 hover:bg-indigo-800/80 text-white font-semibold border border-indigo-400/30 text-sm active:scale-95 transition-all"
          >
            Explore Templates
          </Link>
        </div>
      </section>

    </div>
  );
}
