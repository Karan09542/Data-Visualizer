import React, { useEffect } from 'react';
import { Network, Shield, Share2, Layers, FileJson, FileText, FileSpreadsheet, File, CheckCircle2, ChevronRight, Activity, ArrowRight } from 'lucide-react';

export default function About() {
  useEffect(() => {
    document.title = "About | Data Visualizer";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute("content", "Learn about Data Visualizer, the tool to easily visualize JSON, YAML, CSV, and more.");
    
    // OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", "About | Data Visualizer");
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", "https://datavisualizer.urlmediainspector.dev/about");

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://datavisualizer.urlmediainspector.dev/about");
  }, []);

  const features = [
    {
      icon: <Network className="w-6 h-6 text-indigo-500" />,
      title: "Interactive Node Graphs",
      description: "Visualize relationships and nested hierarchies visually instead of sorting through endless lines of text."
    },
    {
      icon: <Layers className="w-6 h-6 text-indigo-500" />,
      title: "Advanced Schema Mode",
      description: "Simplify extremely large datasets into concise schemas displaying types, structures, and relations."
    },
    {
      icon: <Shield className="w-6 h-6 text-indigo-500" />,
      title: "Client-Side Processing",
      description: "Your data remains strictly on your device. We do not transmit or store your files on external servers."
    },
    {
      icon: <Share2 className="w-6 h-6 text-indigo-500" />,
      title: "Export & Share",
      description: "Share visual representations via unique URL compression or export directly as PDF, PNG, or SVG."
    }
  ];

  const formats = [
    { icon: <FileJson className="w-8 h-8 text-blue-500 mb-3" />, label: "JSON" },
    { icon: <FileText className="w-8 h-8 text-emerald-500 mb-3" />, label: "YAML" },
    { icon: <FileSpreadsheet className="w-8 h-8 text-green-600 mb-3" />, label: "CSV / Excel" },
    { icon: <File className="w-8 h-8 text-slate-500 mb-3" />, label: "Text / Markdown" },
  ];

  const useCases = [
    "Debugging large, nested API responses",
    "Understanding complex Kubernetes YAML configurations",
    "Exploring tabular datasets quickly without specialized spreadsheet software",
    "Documenting data schemas and architectures visually",
    "Presenting structured data clearly to non-technical stakeholders"
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl mb-6">
          <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
          Understand Your Data, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Visually</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
          Data Visualizer is a powerful, client-side developer tool designed to transform complex data structures into intuitive, interactive node graphs, trees, and tables.
        </p>
      </div>

      {/* Features Grid */}
      <div className="mb-20">
        <div className="grid sm:grid-cols-2 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white dark:bg-[#161b22] p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Formats Section */}
      <div className="mb-20 text-center">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-10 tracking-tight">Supported Formats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {formats.map((format, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group cursor-default">
              <div className="transform group-hover:scale-110 transition-transform duration-300">
                {format.icon}
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{format.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950/20 dark:to-slate-900/50 p-8 sm:p-12 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 tracking-tight text-center">Common Use Cases</h2>
          <div className="space-y-4">
            {useCases.map((useCase, idx) => (
              <div key={idx} className="flex items-start bg-white dark:bg-[#161b22] p-4 rounded-2xl shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-indigo-500 mr-4 flex-shrink-0 mt-0.5" />
                <span className="text-lg text-slate-700 dark:text-slate-300">{useCase}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
