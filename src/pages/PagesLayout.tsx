import React from 'react';
import { Link, Outlet } from 'react-router-dom';

const PagesLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117] text-slate-800 dark:text-slate-300 font-sans flex flex-col font-sans transition-colors">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
              <path d="M12 12v9"></path>
              <path d="m16 16-4-4-4 4"></path>
            </svg>
            Data Visualizer
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link to="/about" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-medium">About</Link>
            <Link to="/examples" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-medium">Examples</Link>
            <Link to="/privacy" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-medium">Privacy</Link>
            <Link to="/terms" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-medium">Terms</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-12 w-full">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1117] py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-slate-100">About</Link>
            <Link to="/examples" className="hover:text-slate-900 dark:hover:text-slate-100">Examples</Link>
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-slate-100">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-slate-100">Terms</Link>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} Data Visualizer
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PagesLayout;
