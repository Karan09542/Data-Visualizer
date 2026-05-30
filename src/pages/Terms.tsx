import React, { useEffect } from 'react';

export default function Terms() {
  useEffect(() => {
    document.title = "Terms of Service | Data Visualizer";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute("content", "Terms of Service for using the Data Visualizer application.");
    
    // OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", "Terms of Service | Data Visualizer");
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", "https://datavisualizer.urlmediainspector.dev/terms");

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://datavisualizer.urlmediainspector.dev/terms");
  }, []);

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-bold tracking-tight mb-6">Terms of Service</h1>
      
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
        Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <p className="text-slate-700 dark:text-slate-300">
        By accessing and using Data Visualizer, you accept and agree to be bound by the terms and provision of this agreement.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">1. General Usage Terms</h2>
      <p className="text-slate-700 dark:text-slate-300">
        Data Visualizer is a free utility tool provided "as is". You may use it for personal, academic, or commercial purposes. You agree not to misuse the service or attempt to disrupt its normal functionality.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">2. Disclaimer of Warranties</h2>
      <p className="text-slate-700 dark:text-slate-300">
        The tool is provided without any warranties, express or implied. We do not guarantee that the tool will meet your specific requirements, be uninterrupted, or be entirely error-free. The data rendered is purely visual, and we take no responsibility for data loss or misinterpretation resulting from the use of the app.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">3. Acceptable Use</h2>
      <p className="text-slate-700 dark:text-slate-300">
        As the app processes data entirely client-side, you assume full responsibility for the data you load. You agree not to use the connection features (fetching via external URL) to conduct abusive scraping, denial of service attacks, or to access restricted, confidential data you are not authorized to view.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">4. Limitation of Liability</h2>
      <p className="text-slate-700 dark:text-slate-300">
        In no event shall Data Visualizer, its creators, or contributors be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use or inability to use the specific functionalities of the software, even if advised of the possibility of such damages.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">5. Intellectual Property</h2>
      <p className="text-slate-700 dark:text-slate-300">
        The application interface, design, logo, and core implementation elements belong to the Data Visualizer project. By using the app, no intellectual property rights are passed on to you. You maintain full ownership of any data or APIs you visualize with the tool.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">6. Modifications</h2>
      <p className="text-slate-700 dark:text-slate-300">
        We reserve the right to modify or replace these Terms at any time without prior notice. Continued usage implies acceptance of the new terms.
      </p>
    </div>
  );
}
