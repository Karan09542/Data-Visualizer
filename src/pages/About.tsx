import React, { useEffect } from 'react';

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

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-bold tracking-tight mb-6">About Data Visualizer</h1>
      
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
        Data Visualizer is a powerful, client-side developer tool designed to transform complex data structures — such as JSON, YAML, CSV, and Excel — into intuitive, interactive node graphs, trees, and tables. It helps developers, data scientists, and engineers debug, explore, and present their data effortlessly.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">Key Features</h2>
      <ul className="space-y-2 text-slate-700 dark:text-slate-300">
        <li><strong>Interactive Node Graphs:</strong> Visualize relationships and nested hierarchies visually instead of sorting through endless lines of text.</li>
        <li><strong>Multi-Format Support:</strong> Natively load JSON, YAML, CSV, raw text, and Excel documents.</li>
        <li><strong>Client-Side Processing:</strong> Your data remains strictly on your device. We do not transmit or store your files on external servers.</li>
        <li><strong>Export & Share:</strong> Share visual representations via unique URL compression or export directly as PDF, PNG, or SVG.</li>
        <li><strong>Advanced Schema Mode:</strong> Simplify extremely large datasets into concise schemas displaying types and structures.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">Supported Formats</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-center font-medium">JSON</div>
        <div className="p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-center font-medium">YAML</div>
        <div className="p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-center font-medium">CSV/Excel</div>
        <div className="p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-center font-medium">Text/Markdown</div>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">Common Use Cases</h2>
      <ul className="space-y-2 text-slate-700 dark:text-slate-300">
        <li>Debugging large, nested API responses</li>
        <li>Understanding complex Kubernetes YAML configurations</li>
        <li>Exploring tabular datasets quickly without specialized spreadsheet software</li>
        <li>Documenting data schemas and architectures visually</li>
        <li>Presenting structured data clearly to non-technical stakeholders</li>
      </ul>
    </div>
  );
}
