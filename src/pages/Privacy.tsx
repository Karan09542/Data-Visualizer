import React, { useEffect } from 'react';

export default function Privacy() {
  useEffect(() => {
    document.title = "Privacy Policy | Data Visualizer";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute("content", "Privacy Policy for Data Visualizer. Learn how we handle your data.");
    
    // OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", "Privacy Policy | Data Visualizer");
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", "https://datavisualizer.urlmediainspector.dev/privacy");

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://datavisualizer.urlmediainspector.dev/privacy");
  }, []);

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-bold tracking-tight mb-6">Privacy Policy</h1>
      
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
        Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <p className="text-slate-700 dark:text-slate-300">
        Data Visualizer operates as a strictly client-side application. We value your privacy and trust. Below is an overview of how data is managed when you use our tool.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">1. File Handling & Data Processing</h2>
      <p className="text-slate-700 dark:text-slate-300">
        All files and text inputs (JSON, YAML, CSV, etc.) are parsed, processed, and visualized <strong>entirely within your browser</strong>. 
        We do not upload, transmit, or store your actual file contents on any external servers. Your data remains strictly on your device.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">2. Browser Storage Usage</h2>
      <p className="text-slate-700 dark:text-slate-300">
        We utilize local technologies such as <code>localStorage</code> and IndexedDB solely to:
      </p>
      <ul className="text-slate-700 dark:text-slate-300">
        <li>Save your user preferences (e.g., dark mode, theme settings, visualizer modes).</li>
        <li>Autosave drafts and local documents explicitly saved by you within the app.</li>
      </ul>
      <p className="text-slate-700 dark:text-slate-300">
        This local data is never synced to external servers or accessible to Data Visualizer operators.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">3. API Requests</h2>
      <p className="text-slate-700 dark:text-slate-300">
        Data Visualizer may make external network requests in specific, user-initiated circumstances:
      </p>
      <ul className="text-slate-700 dark:text-slate-300">
        <li><strong>Connecting to URLs:</strong> If you explicitly ask the app to fetch data from an external URL, your browser will make a direct request to that URL.</li>
        <li><strong>AI Features:</strong> If you provide an API key for third-party AI features (such as Gemini integrations), your browser makes a direct request to the respective provider. We do not proxy or intercept these requests.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">4. Analytics and Cookies</h2>
      <p className="text-slate-700 dark:text-slate-300">
        Currently, we collect standard server access logs (such as IP addresses and browser types for security purposes) through our hosting provider.
        In the future, we may implement standard analytics and advertising cookies (such as Google AdSense) to support the service. These tools will collect anonymized behavioral data in accordance with their respective industry-standard privacy policies.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 tracking-tight">5. Contact</h2>
      <p className="text-slate-700 dark:text-slate-300">
        If you have any questions or concerns regarding this policy, please reach out through our project repository or contact channels.
      </p>
    </div>
  );
}
